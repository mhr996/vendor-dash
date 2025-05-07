import LanguageDropdown from '@/components/language-dropdown';
import { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
    title: 'Email Confirmation',
};

const EmailConfirmation = () => {
    return (
        <div>
            <div className="absolute inset-0">
                <img src="/assets/images/auth/bg-gradient.png" alt="image" className="h-full w-full object-cover" />
            </div>
            <div className="relative flex min-h-screen items-center justify-center bg-[url(/assets/images/auth/map.png)] bg-cover bg-center bg-no-repeat px-6 py-10 dark:bg-[#060818] sm:px-16">
                <img src="/assets/images/auth/coming-soon-object1.png" alt="image" className="absolute left-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <img src="/assets/images/auth/coming-soon-object2.png" alt="image" className="absolute right-0 top-1/2 h-full max-h-[893px] -translate-y-1/2" />
                <div className="relative w-full max-w-[870px] rounded-md bg-[linear-gradient(45deg,#fff9f9_0%,rgba(255,255,255,0)_25%,rgba(255,255,255,0)_75%,_#fff9f9_100%)] p-2 dark:bg-[linear-gradient(45deg,#1e2228_0%,rgba(30,34,40,0)_25%,rgba(30,34,40,0)_75%,_#1e2228_100%)]">
                    <div className="relative rounded-md bg-white/60 px-6 py-12 backdrop-blur-lg dark:bg-black/50 dark:backdrop-blur-lg sm:px-12 md:px-24">
                        <div className="absolute top-6 end-6">
                            <LanguageDropdown />
                        </div>
                        <div className="mb-16 flex items-center justify-center">
                            <div className="w-full max-w-[480px] text-center">
                                <div className="mb-8">
                                    <h1 className="mb-6 text-4xl font-extrabold uppercase !leading-snug text-primary md:text-5xl">Check your inbox</h1>
                                    <p className="text-lg font-medium leading-relaxed dark:text-white">
                                        We've sent a confirmation email to your inbox. Please check your email and click on the confirmation link to activate your account.
                                    </p>
                                </div>
                                <div className="mt-10">
                                    <p className="text-sm dark:text-white">
                                        Haven't received an email yet? Check your spam folder or
                                        <Link href="/auth/login" className="text-primary hover:underline ms-1">
                                            return to login
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailConfirmation;
