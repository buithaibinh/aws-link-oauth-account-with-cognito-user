import {
  PreSignUpTriggerHandler,
  PreSignUpTriggerEvent,
  PostAuthenticationTriggerEvent
} from 'aws-lambda';
import {
  findUserByEmail,
  createUser,
  linkSocialAccount,
  setUserPassword,
  updateUserAttributes
} from './utils';

export const preSignup: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent
) => {
  console.log('preSignup event', event);

  const { triggerSource, userPoolId, userName, request } = event;

  // Note: triggerSource can be either PreSignUp_SignUp or PreSignUp_ExternalProvider depending on how the user signed up
  // incase signup is done with email and password then triggerSource is PreSignUp_SignUp
  // incase signup is done with Google then triggerSource is PreSignUp_ExternalProvider

  if (triggerSource === 'PreSignUp_ExternalProvider') {
    // if user signed up with Google then we need to link the Google account to the user pool
    const {
      userAttributes: { email, given_name, family_name }
    } = request;

    // if the user is found then we link the Google account to the user pool
    const user = await findUserByEmail(email, userPoolId);

    // userName example: "Facebook_12324325436" or "Google_1237823478"
    // we need to extract the provider name and provider value from the userName
    let [providerName, providerUserId] = userName.split('_');

    // Uppercase the first letter because the event sometimes
    // has it as google_1234 or facebook_1234. In the call to `adminLinkProviderForUser`
    // the provider name has to be Google or Facebook (first letter capitalized)
    providerName = providerName.charAt(0).toUpperCase() + providerName.slice(1);

    // if the user is found then we link the Google account to the user pool
    if (user) {
      await linkSocialAccount({
        userPoolId: userPoolId,
        cognitoUsername: user.Username,
        providerName: providerName,
        providerUserId: providerUserId
      });

      // return the event to continue the signup process
      return event;
    } else {
      // if the user is not found then we need to create the user in the user pool

      // 1. create a native cognito account
      const newUser = await createUser({
        userPoolId: userPoolId,
        email,
        givenName: given_name,
        familyName: family_name
      });

      if (!newUser) {
        throw new Error('Failed to create user');
      }

      // 2. change the password, to change status from FORCE_CHANGE_PASSWORD to CONFIRMED
      await setUserPassword({
        userPoolId: userPoolId,
        email
      });

      // 3. merge the social and the native accounts
      await linkSocialAccount({
        userPoolId: userPoolId,
        cognitoUsername: newUser.Username,
        providerName: providerName,
        providerUserId: providerUserId
      });

      // set the email_verified to true so that the user doesn't have to verify the email
      // set the autoConfirmUser to true so that the user doesn't have to confirm the signup
      event.response.autoVerifyEmail = true;
      event.response.autoConfirmUser = true;
    }
  }

  // if the user signed up with email and password then we don't need to do anything
  return event;
};

export const postAuthentication = async (
  event: PostAuthenticationTriggerEvent
) => {
  console.log('postAuthentication event', event);

  // set email_verified to true so that the user doesn't have to verify the email
  if (event.request.userAttributes.email_verified !== 'true') {
    await updateUserAttributes(event.userPoolId, event.userName, {
      email_verified: 'true'
    });
  }

  return event;
};
