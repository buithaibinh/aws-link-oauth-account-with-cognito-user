import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // a pre-signup lambda trigger to link the user's Google account to the user pool
    const preSignUpLambda = new NodejsFunction(this, 'PreSignUpLambda', {
      runtime: lambda.Runtime.NODEJS_18_X, // we use node 18 for aws-sdk v3 support
      handler: 'preSignup',
      entry: 'functions/triggers/index.ts',
      bundling: {
        externalModules: [
          // exclude aws sdk v3 from the bundle
          'aws-sdk'
        ],
        minify: false
      }
    });

    // a post-authentication lambda trigger to update the user's last login time
    const postAuthenticationLambda = new NodejsFunction(
      this,
      'PostAuthenticationLambda',
      {
        runtime: lambda.Runtime.NODEJS_18_X, // we use node 18 for aws-sdk v3 support
        handler: 'postAuthentication',
        entry: 'functions/triggers/index.ts',
        bundling: {
          externalModules: [
            // exclude aws sdk v3 from the bundle
            'aws-sdk'
          ],
          minify: false
        }
      }
    );

    //  first, create a user pool allow users to sign in with their Google account or email and password
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true, // allow users to sign up themselves
      signInAliases: {
        email: true
      },

      standardAttributes: {
        email: { required: true, mutable: true }
      },

      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireDigits: false,
        requireUppercase: false,
        requireSymbols: false
      },

      removalPolicy: cdk.RemovalPolicy.DESTROY, // we want to destroy the user pool when we destroy the stack. This is for testing purposes only.

      lambdaTriggers: {
        preSignUp: preSignUpLambda,
        postAuthentication: postAuthenticationLambda
      }
    });

    // attach role policies to the pre-signup lambda trigger
    preSignUpLambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'PreSignUpLambdaPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:AdminLinkProviderForUser', // this is needed to link the user's Google account to the user pool
              'cognito-idp:ListUsers', // this is needed to get the user by email
              'cognito-idp:AdminCreateUser', // this is needed to create the user if it doesn't exist
              'cognito-idp:AdminSetUserPassword', // this is needed to set the user's password
              'cognito-idp:AdminUpdateUserAttributes' // this is needed to update the user's attributes
            ],
            resources: [userPool.userPoolArn]
          })
        ]
      })
    );

    // attach role policies to the post-authentication lambda trigger
    postAuthenticationLambda.role?.attachInlinePolicy(
      new iam.Policy(this, 'PostAuthenticationLambdaPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              'cognito-idp:AdminUpdateUserAttributes' // this is needed to update the user's attributes
            ],
            resources: [userPool.userPoolArn]
          })
        ]
      })
    );

    // domain prefix is the subdomain of the Cognito hosted UI
    // e.g. https://<domain prefix>.auth.<region>.amazoncognito.com
    // the domain prefix must be unique across all Cognito user pools in the same region
    // so we use the stack name as the domain prefix
    const domain = userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `${cdk.Stack.of(this).stackName.toLocaleLowerCase()}-demo`
      }
    });

    // Create a Google OAuth provider
    const googleIdentityProvider = new cognito.UserPoolIdentityProviderGoogle(
      this,
      'GoogleIdentityProvider',
      {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        userPool,

        scopes: ['openid', 'email', 'profile'], // scopes to request from Google
        // the attributes that we want to get from Google
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE
        }
      }
    );

    // user pool client
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'web-client',
      generateSecret: false,
      preventUserExistenceErrors: true,

      // OAuth 2.0
      oAuth: {
        callbackUrls: ['http://localhost:3000/callback'], // the callback url of the client
        logoutUrls: ['http://localhost:3000'], // the logout url of the client
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN
        ]
      },

      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE
      ]
    });

    // attach the created provider to our userpool client
    userPoolClient.node.addDependency(googleIdentityProvider);

    // output the user pool id and client id
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId
    });

    // domain name of the Cognito
    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: `https://${domain.domainName}.auth.${cdk.Aws.REGION}.amazoncognito.com`
    });
  }
}
