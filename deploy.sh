#!/usr/bin/env bash

set -e
source ./env.sh

echo "Deploying backend stack..."

# deploy the cdk stack (ignore the error in case it's due to 'No updates are to be performed')
npm run cdk-deploy --prefix cdk --silent || true

STACK_STATUS=$(aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --region "${STACK_REGION}" --query "Stacks[].StackStatus[]" --output text)

if [[ "${STACK_STATUS}" != "CREATE_COMPLETE" && "${STACK_STATUS}" != "UPDATE_COMPLETE" ]]; then
  echo "Stack is in an unexpected status: ${STACK_STATUS}"
  exit 1
fi