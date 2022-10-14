const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.46.0',
  defaultReleaseBranch: 'main',
  name: 'ecs-fargate-cicd-blue-green-demo',
  authorName: 'Neil Kuan',
  authorEmail: 'guan840912@gmail.com',
  repository: 'https://github.com/neilkuan/ecs-fargate-cicd-blue-green-demo.git',
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
