import { Template } from '@aws-cdk/assertions';
import { App } from '@aws-cdk/core';
import { DevStack } from '../src/main';

test('Testing', () => {
  const app = new App();

  const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };
  const stack = new DevStack(app, 'test', { env });
  const assert = Template.fromStack(stack);
  assert.hasResourceProperties('AWS::EC2::VPC', {});
  assert.hasResourceProperties('AWS::CodeBuild::Project', {});
  assert.hasResourceProperties('AWS::CodePipeline::Pipeline', {});
  assert.hasResourceProperties('AWS::CodeDeploy::Application',
    {
      ApplicationName: 'ecs-application',
      ComputePlatform: 'ECS',
    });

  assert.hasResourceProperties('AWS::ECS::Service',
    {
      Cluster: {
        Ref: 'ecscluster7830E7B5',
      },
      DeploymentConfiguration: {
        MaximumPercent: 200,
        MinimumHealthyPercent: 50,
      },
      DeploymentController: {
        Type: 'CODE_DEPLOY',
      },
    });
});