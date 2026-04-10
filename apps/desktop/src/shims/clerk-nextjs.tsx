import {
  ClerkProvider as ClerkReactProvider,
  SignIn as ClerkReactSignIn,
  SignUp as ClerkReactSignUp,
  useAuth as useClerkAuth,
  useClerk as useClerkReact,
  useOrganization as useClerkOrganization,
  useUser as useClerkUser,
  type ClerkProviderProps,
} from "@clerk/clerk-react";
import { type ComponentProps } from "react";

export function ClerkProvider(props: ClerkProviderProps) {
  return <ClerkReactProvider {...props} />;
}

export const useAuth = useClerkAuth;
export const useUser = useClerkUser;
export const useClerk = useClerkReact;
export const useOrganization = useClerkOrganization;

type SignInProps = ComponentProps<typeof ClerkReactSignIn>;
type SignUpProps = ComponentProps<typeof ClerkReactSignUp>;

export function SignIn(props: SignInProps) {
  const routing = props.path === undefined ? (props.routing ?? "virtual") : props.routing;
  return <ClerkReactSignIn {...props} routing={routing} signUpUrl={props.signUpUrl ?? "/sign-up"} />;
}

export function SignUp(props: SignUpProps) {
  const routing = props.path === undefined ? (props.routing ?? "virtual") : props.routing;
  return <ClerkReactSignUp {...props} routing={routing} signInUrl={props.signInUrl ?? "/sign-in"} />;
}
