'use client';
import IconLockDots from '@/components/icon/icon-lock-dots';
import IconMail from '@/components/icon/icon-mail';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { signIn } from '@/lib/auth';
import Link from 'next/link';

interface FormErrors {
    email?: string;
    password?: string;
    general?: string;
}

const ComponentsAuthLoginForm = () => {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validateForm = () => {
        const newErrors: FormErrors = {};

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            newErrors.email = 'Email is required';
        } else if (!emailRegex.test(email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        // Password validation
        if (!password) {
            newErrors.password = 'Password is required';
        }

        return newErrors;
    };

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors({});

        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setIsSubmitting(false);
            return;
        }

        try {
            const { user, error, errorCode } = await signIn(email, password);

            if (error) {
                // Check for the specific email not confirmed error
                if (errorCode === 'email_not_confirmed') {
                    setErrors({ general: 'Your email has not been confirmed yet. Please check your inbox and confirm your email before logging in.' });
                   
                } else {
                    setErrors({ general: error });
                }
            } else {
                // Check if email is confirmed
                if (user && !user.email_confirmed_at) {
                    router.push('/email-confirmation');
                } else {
                    router.push('/');
                }
            }
        } catch (error) {
            setErrors({ general: 'An unexpected error occurred. Please try again.' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form className="space-y-5" onSubmit={submitForm}>
            {errors.general && (
                <div className={`text-white p-3 rounded-md mb-4 ${errors.general.includes('not been confirmed') ? 'bg-amber-500' : 'bg-red-500'}`}>
                    {errors.general}
                 
                </div>
            )}

            <div>
                <label htmlFor="Email">Email</label>
                <div className="relative text-white-dark">
                    <input
                        id="Email"
                        type="email"
                        placeholder="Enter Email"
                        className={`form-input ps-10 placeholder:text-white-dark ${errors.email ? 'border-red-500' : ''}`}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconMail fill={true} />
                    </span>
                </div>
                {errors.email && <span className="text-red-500 text-sm mt-1">{errors.email}</span>}
            </div>
            <div>
                <label htmlFor="Password">Password</label>
                <div className="relative text-white-dark">
                    <input
                        id="Password"
                        type="password"
                        placeholder="Enter Password"
                        className={`form-input ps-10 placeholder:text-white-dark ${errors.password ? 'border-red-500' : ''}`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconLockDots fill={true} />
                    </span>
                </div>
                {errors.password && <span className="text-red-500 text-sm mt-1">{errors.password}</span>}
            </div>
            <div>
                <Link href="/reset-password" className="text-primary hover:underline font-bold">
                    Forgot password?
                </Link>
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing In...' : 'SIGN IN'}
            </button>
        </form>
    );
};

export default ComponentsAuthLoginForm;
