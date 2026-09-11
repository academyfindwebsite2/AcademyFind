import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { emailOTP } from "better-auth/plugins";
import { oneTap } from "better-auth/plugins";
import { Resend } from "resend";
import dotenv from 'dotenv';

dotenv.config();

// 1. Initialize Resend
// (Make sure RESEND_API_KEY is properly set in your .env file)
const resend = new Resend(process.env.RESEND_API_KEY!);

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    trustedOrigins: [
        "https://academyfind.com",
        "http://localhost:3000",
        "exp://",           // Expo development
        "academyfind://",   // Production deep link
    ],

    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
    },
    // Map your custom columns so Better Auth exposes them to your sessions
    user: {
        additionalFields: {
            role: {
                type: "string",
                required: false,
                defaultValue: "USER",
            },
            phone: {
                type: "string",
                required: false,
            },
            onboardingCompleted: {
                type: "boolean",
                required: false,
                defaultValue: false,
            },
            isActive: {
                type: "boolean",
                required: false,
                defaultValue: true,
            },
            username: {
                type: "string",
                required: false,
            },
        },
    },
    // Optional: Boost performance by allowing Better Auth to use SQL joins (v1.4+)
    experimental: {
        joins: true,
    },
    rateLimit: {
        window: 60, // 60 seconds
        max: 1000, // Increase max requests to avoid 429 errors from mobile app
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    // Generate a random username if not provided
                    if (!user.username) {
                        const emailPrefix = user.email.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
                        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                        return {
                            data: {
                                ...user,
                                username: `${emailPrefix}${randomSuffix}`,
                            }
                        };
                    }
                    return { data: user };
                },
                after: async (user) => {
                    const { creditWallet } = await import("@/lib/wallet/credit");
                    const { AF_COINS_EARN } = await import("@/lib/wallet/af-coins");
                    await creditWallet(user.id, AF_COINS_EARN.SIGN_UP, "SIGN_UP", "Welcome Bonus for registering!");
                }
            }
        }
    },

    plugins: [
        emailOTP({
            expiresIn: 600, // 10 minutes expiry for all OTP codes and links
            async sendVerificationOTP({ email, otp, type }) {
                let subject = "";
                let heading = "AcademyFind";
                let messageText = "";
                let actionText = "Verify Automatically";
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://academyfind.com';
                let actionLink = `${baseUrl}/verify-email?email=${encodeURIComponent(email)}&otp=${otp}&type=${type}`;

                if (type === "sign-in") {
                    subject = "Your Login Code - AcademyFind";
                    heading = "Sign In to AcademyFind";
                    messageText = "Welcome back! Use the verification code below to complete your sign in:";
                    actionText = "Sign In Automatically";
                } else if (type === "email-verification") {
                    subject = "Verify Your Email - AcademyFind";
                    heading = "Verify Your Email Address";
                    messageText = "Welcome to AcademyFind! Please verify your email address using this verification code:";
                    actionText = "Verify Email";
                } else if (type === "forget-password") {
                    subject = "Reset Your Password - AcademyFind";
                    heading = "Reset Your Password";
                    messageText = "We received a request to reset your password. Use the verification code below or click the button to set your new password:";
                    actionText = "Reset Password";
                    actionLink = `${baseUrl}/forgot-password?email=${encodeURIComponent(email)}&otp=${otp}`;
                }

                // Resend email
                try {
                    const result = await resend.emails.send({
                        from: 'AcademyFind <Verification@academyfind.com>',
                        to: email,
                        subject: subject,
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #f1f5f9; border-radius: 16px; color: #1e293b;">
                                <div style="text-align: center; margin-bottom: 24px;">
                                    <div style="display: inline-block; padding: 8px 16px; background-color: #fef3c7; border-radius: 9999px;">
                                        <span style="font-size: 18px; font-weight: 700; color: #d97706; letter-spacing: 0.5px;">AcademyFind</span>
                                    </div>
                                    <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 16px; margin-bottom: 8px;">${heading}</h2>
                                    <p style="font-size: 15px; color: #64748b; line-height: 1.5; margin: 0;">${messageText}</p>
                                </div>

                                <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; text-align: center;">
                                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px;">Your 6-Digit Code</div>
                                    <strong style="font-size: 32px; letter-spacing: 6px; color: #d97706; font-family: monospace;">${otp}</strong>
                                </div>

                                <div style="text-align: center; margin: 28px 0 20px;">
                                    <a href="${actionLink}" style="display: inline-block; padding: 14px 32px; background-color: #f59e0b; color: #ffffff; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">${actionText}</a>
                                    <p style="font-size: 12px; margin-top: 14px; color: #94a3b8;">Or click or copy this URL into your browser:<br/><a href="${actionLink}" style="color: #f59e0b; word-break: break-all;">${actionLink}</a></p>
                                </div>

                                <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
                                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0; text-align: center;">
                                    This code is valid for 10 minutes. If you did not request this, please ignore this email or contact our support team.
                                </p>
                            </div>
                        `,
                    });

                    if (result.error) {
                        console.error(`❌ Resend API Error:`, result.error);
                    } else {
                        console.log(`✅ Successfully sent ${type} OTP via Resend to ${email}`);
                    }

                } catch (err) {
                    console.error(`❌ Failed to send ${type} email via Resend:`, err);
                }
            }
        }),
        oneTap()
    ]
});