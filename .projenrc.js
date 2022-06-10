const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '1.124.0',
  defaultReleaseBranch: 'main',
  name: 'ecs-fargate-cicd-blue-green-demo',
  authorName: 'Neil Kuan',
  authorEmail: 'guan840912@gmail.com',
  repository: 'https://github.com/neilkuan/ecs-fargate-cicd-blue-green-demo.git',
  cdkDependencies: [
    '@aws-cdk/core',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-ecs',
    '@aws-cdk/aws-ecr',
    '@aws-cdk/aws-s3',
    '@aws-cdk/aws-iam',
    '@aws-cdk/aws-lambda',
    '@aws-cdk/assertions',
    '@aws-cdk/custom-resources',
    '@aws-cdk/aws-ecs-patterns',
    '@aws-cdk/aws-ecr-assets',
    '@aws-cdk/aws-codecommit',
    '@aws-cdk/aws-codebuild',
    '@aws-cdk/aws-codedeploy',
    '@aws-cdk/aws-codepipeline-actions',
    '@aws-cdk/aws-codepipeline',
    '@aws-cdk/aws-elasticloadbalancingv2',
  ],
  gitignore: [
    'cdk.context.json', 'cdk.out', 'images',
  ],
  depsUpgradeOptions: {
    workflowOptions: {
      labels: ['auto-approve'],
    },
  },
  autoApproveOptions: {
    secret: 'GITHUB_TOKEN',
    allowedUsernames: ['neilkuan'],
  },
  typescriptVersion: '4.6',
  devDeps: [
    '@types/prettier@2.6.0',
  ],
});
project.synth();
