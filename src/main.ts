// import * as path from 'path';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codecommit from '@aws-cdk/aws-codecommit';
import * as codedeploy from '@aws-cdk/aws-codedeploy';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecr from '@aws-cdk/aws-ecr';
// import { DockerImageAsset } from '@aws-cdk/aws-ecr-assets';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as iam from '@aws-cdk/aws-iam';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
export class DevStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: cdk.StackProps = {}) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'vpc', { natGateways: 1 });

    // Create a new ECR Repository
    const repo = ecr.Repository.fromRepositoryName(this, 'NginxRepo', 'nginx');

    // new DockerImageAsset(this, 'CDKDockerImage', {
    //   directory: path.join(__dirname, '../docker'),
    //   repositoryName: 'nginx',
    // });

    // cdk.Stack.of(this).synthesizer.addDockerImageAsset({ sourceHash: 'Dockerfile', repositoryName: 'nginx' });


    const cluster = new ecs.Cluster(this, 'ecs-cluster', {
      vpc: vpc,
      clusterName: 'demoECSCICD',
    });

    // ***ECS Contructs***

    const executionRolePolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      resources: ['*'],
      actions: [
        'ecr:GetAuthorizationToken',
        'ecr:BatchCheckLayerAvailability',
        'ecr:GetDownloadUrlForLayer',
        'ecr:BatchGetImage',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
    });
    const devtaskDef = new ecs.FargateTaskDefinition(this, 'dev-taskdef');
    devtaskDef.addToExecutionRolePolicy(executionRolePolicy);
    devtaskDef.addContainer('nginx', {
      image: ecs.ContainerImage.fromEcrRepository(repo),
      memoryReservationMiB: 256,
      cpu: 256,
      portMappings: [{ containerPort: 80 }],
      environment: {
        APPLE: 'yes',
      },
    });

    const devfargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'dev-service', {
      serviceName: 'devfargateService',
      cluster: cluster,
      taskDefinition: devtaskDef,
      publicLoadBalancer: true,
      desiredCount: 1,
      assignPublicIp: true,
      listenerPort: 80,
      taskSubnets: vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      deploymentController: {
        type: ecs.DeploymentControllerType.CODE_DEPLOY,
      },
    });
    // ECR - repo
    const codecommitRepo = new codecommit.Repository(this, 'codecommit-repo', {
      repositoryName: 'ecsCicdDemo',
    });
    const artifactBucket = new s3.Bucket(this, 'MyECSPipelineArtifactBucket', {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new cdk.CfnOutput(this, 'CodeCommitRepo', {
      value: `git clone ${codecommitRepo.repositoryCloneUrlSsh}`,
    });

    new cdk.CfnOutput(this, 'executionRoleArn', {
      value: devfargateService.service.taskDefinition.executionRole!.roleArn,
    });

    new cdk.CfnOutput(this, 'taskRoleArn', {
      value: devfargateService.service.taskDefinition.taskRole!.roleArn,
    });

    new cdk.CfnOutput(this, 'family', {
      value: devfargateService.service.taskDefinition.family,
    });

    this.createPipeline(codecommitRepo, 'dev', devfargateService.service, artifactBucket, 'nginx', 'nginx', devfargateService, vpc);


  }
  private createPipeline (
    codecommitRepo: codecommit.IRepository, env: string, svc: ecs.IBaseService, artifactBucket: s3.IBucket,
    containerName: string, ecrRepoName: string, fargateService: ecs_patterns.ApplicationLoadBalancedFargateService, vpc: ec2.Vpc) {
    // CODEBUILD - project
    const codecommitSource = codebuild.Source.codeCommit({
      repository: codecommitRepo,
    });

    const project = new codebuild.Project(this, `MyProject-${env}`, {
      projectName: `${this.stackName}-${env}`,
      source: codecommitSource,
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_3,
        privileged: true,
      },
      environmentVariables: {
        ECR_REPO_NAME: { value: ecrRepoName },
        CONTAINER_NAME: { value: containerName },
        AWS_DEFAULT_REGION: { value: this.region },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              'echo "In Post-Build Stage"',
              'export TAG=`cat version.txt`',
              'export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output=text)',
              'export ECR_REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com/$ECR_REPO_NAME"',
              'echo "New Version is $ECR_REPO_URI:$TAG ..."',
              'export CHECK=$(aws ecr list-images --repository-name $ECR_REPO_NAME --query \"imageIds[?imageTag==\\`$TAG\\`].imageTag\" --filter tagStatus="TAGGED" --output text | grep $TAG | wc -l)',
              'if [ $CHECK == 1 ];then echo "okay! This version is existed"; else echo "This image version not found" && exit 1; fi',
              'printf \'{\"ImageURI\":\"%s\"}\' $ECR_REPO_URI:$TAG > imageDetail.json',
              'pwd; ls -al; cat imageDetail.json',
            ],
          },
        },
        // imagedefinitions.json file for Amazon ECS standard deployment actions
        // https://docs.aws.amazon.com/codepipeline/latest/userguide/file-reference.html#pipelines-create-image-definitions
        // imageDetail.json file for Amazon ECS blue/green deployment actions
        // https://docs.aws.amazon.com/codepipeline/latest/userguide/file-reference.html#file-reference-ecs-bluegreen
        artifacts: {
          files: [
            'appspec.yaml',
            'taskdef.json',
            'imageDetail.json',
          ],
        },
      }),
    });

    // ***PIPELINE ACTIONS***

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    var branch = 'master';
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: `CodeCommit_Source_${branch}`,
      branch,
      repository: codecommitRepo,
      output: sourceOutput,
    });

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'CodeBuild',
      project,
      input: sourceOutput,
      outputs: [buildOutput],
    });

    const manualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Approve',
    });
    // const deployAction = new codepipeline_actions.EcsDeployAction({
    //   actionName: 'DeployAction',
    //   service: svc,
    //   imageFile: new codepipeline.ArtifactPath(buildOutput, 'imagedefinitions.json'),
    // });
    const ecsApplication = new codedeploy.EcsApplication(this, 'ecs-application', {
      applicationName: 'ecs-application',
    });

    const codeDeployServiceRole = new iam.Role(this, 'codeDeployServiceRole', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
    });
    codeDeployServiceRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCodeDeployRoleForECS'));


    const cr = new lambda.Function(this, 'CR', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: new lambda.AssetCode('cr'),
      handler: 'index.handler',
      description: 'Custom resource to create a CodeDeploy deployment group',
      memorySize: 128,
      timeout: cdk.Duration.seconds(60),
    });
    cr.role!.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['iam:PassRole',
        'sts:AssumeRole',
        'codedeploy:List*',
        'codedeploy:Get*',
        'codedeploy:UpdateDeploymentGroup',
        'codedeploy:CreateDeploymentGroup',
        'codedeploy:DeleteDeploymentGroup'],
      resources: ['*'],
    }));

    const greenTG = new elb.ApplicationTargetGroup(this, 'greenTG', {
      targetGroupName: 'greenTG',
      port: 80,
      targetType: elb.TargetType.IP,
      vpc,
    });

    const greenListner = new elb.ApplicationListener(this, 'greenListener', {
      loadBalancer: fargateService.loadBalancer,
      port: 8100,
      open: true,
      protocol: elb.ApplicationProtocol.HTTP,
      defaultAction: elb.ListenerAction.forward([greenTG]),
    });
    greenTG.registerListener(greenListner);

    // greenTG.node.addDependency(greenListner);
    new cdk.CustomResource(this, 'ecsdeploygroup', {
      resourceType: 'Custom::ECSDeployGroup',
      serviceToken: cr.functionArn,
      properties: {
        ApplicationName: ecsApplication.applicationName,
        DeploymentGroupName: 'demo-bg',
        DeploymentConfigName: 'CodeDeployDefault.ECSAllAtOnce',
        ServiceRoleArn: codeDeployServiceRole.roleArn,
        BlueTargetGroup: fargateService.targetGroup.targetGroupName,
        GreenTargetGroup: greenTG.targetGroupName,
        ProdListenerArn: fargateService.listener.listenerArn,
        TestListenerArn: greenListner.listenerArn,
        EcsClusterName: svc.cluster.clusterName,
        EcsServiceName: svc.serviceName,
        TerminationWaitTime: 10,
      },
    });
    const deployAction = new codepipeline_actions.CodeDeployEcsDeployAction({
      actionName: 'DeployAction',
      deploymentGroup: codedeploy.EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(this, 'DeploymentGroup', {
        application: ecsApplication,
        deploymentGroupName: 'demo-bg',
        deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      }),
      taskDefinitionTemplateInput: buildOutput,
      appSpecTemplateInput: buildOutput,
      containerImageInputs: [
        {
          input: buildOutput,
        },
      ],
    });


    // PIPELINE STAGES

    new codepipeline.Pipeline(this, `MyECSPipeline${env}`, {
      pipelineName: `${this.stackName}-${env}-pipeline`,
      artifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        },
        {
          stageName: 'Build',
          actions: [buildAction],
        },
        {
          stageName: 'Approve',
          actions: [manualApprovalAction],
        },
        {
          stageName: 'Deploy-to-ECS',
          actions: [deployAction],
        },
      ],
    });
    project.role!.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryFullAccess'));
    return project;
  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new cdk.App();

new DevStack(app, 'my-stack-dev', { env: devEnv });

app.synth();