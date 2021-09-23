# ecs-fargate-cicd-blue-green-demo


### To Install
```bash
yarn 
```

###
```bash
cdk diff
```

### Create ECR Repository
```bash
aws ecr create-repository --repository-name nginx

aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin xxxxxxx.dkr.ecr.xxxxx.amazonaws.com

docker tag nginx:latest xxxxxxx.dkr.ecr.xxxxx.amazonaws.com/nginx:latest

docker push xxxxxxx.dkr.ecr.xxxxx.amazonaws.com/nginx:latest
```

### To Deploy
```bash
cdk deploy
```

### clone `CodeCommit` repo.
```bash
git clone ssh://git-codecommit.xxxx.amazonaws.com/v1/repos/ecsCicdDemo

cp ecsCicdDemo-template/* ecsCicdDemo/

cd ecsCicdDemo/

# !!!! edit <executionRoleArn> , <taskRoleArn>, <family>, <taskRoleArn> to your env CfnOutput
# and then commit deploy to code commit repo.

git add .

git commit -m "release 0.0.1"

git push
```

### To Destroy
```bash
cdk destroy
```