import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields, oneTapClient } from "better-auth/client/plugins"
import type { auth } from "./auth";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "",
    plugins:[
        emailOTPClient(),
        inferAdditionalFields<typeof auth>(),
        oneTapClient({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
            promptOptions: {
                fedCM: false,
            },
            cancelOnTapOutside: true,
            context: "signin",
        })
    ]
});
