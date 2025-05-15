'use client';
import React, { useState, useEffect } from 'react';
import supabase from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import IconShoppingBag from '@/components/icon/icon-shopping-bag';
import IconShoppingCart from '@/components/icon/icon-shopping-cart';
import IconCalendar from '@/components/icon/icon-calendar';

// Types
interface License {
    id: number;
    title: string;
    desc: string;
    price: number;
    shops: number; // Number of allowed shops
    products: number; // Number of allowed products
}

interface Subscription {
    id: number;
    license_id: number;
    profile_id: string;
    created_at: string;
    status: string;
    license?: License;
}

interface UserCounts {
    shops: number;
    products: number;
}

const LicenseManagement = () => {
    const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
    const [availableLicenses, setAvailableLicenses] = useState<License[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'warning'; message: string } | null>(null);
    const [userCounts, setUserCounts] = useState<UserCounts>({ shops: 0, products: 0 });

    useEffect(() => {
        fetchLicenseData();
    }, []);

    const fetchLicenseData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Get current user
            const { user, error: userError } = await getCurrentUser();
            if (userError) throw new Error(userError);
            if (!user) throw new Error('No user found');

            // Fetch all licenses
            const { data: licensesData, error: licensesError } = await supabase.from('licenses').select('*').order('price', { ascending: true });

            if (licensesError) throw licensesError;
            setAvailableLicenses(licensesData || []);

            // Fetch user's current subscription
            const { data: subscriptionData, error: subscriptionError } = await supabase
                .from('subscriptions')
                .select('*, license:license_id(*)')
                .eq('profile_id', user.id)
                .eq('status', 'Active')
                .single();

            if (subscriptionError && subscriptionError.code !== 'PGRST116') {
                // PGRST116 is "no rows returned" which just means no active subscription
                throw subscriptionError;
            }

            if (subscriptionData) {
                setCurrentSubscription(subscriptionData);
            }

            // Fetch user's shop count
            const { data: shopsData, error: shopsError } = await supabase.from('shops').select('count').eq('owner', user.id);

            if (shopsError) throw shopsError;

            // Fetch user's product count
            const { data: userShops } = await supabase.from('shops').select('id').eq('owner', user.id);

            if (userShops && userShops.length > 0) {
                const shopIds = userShops.map((shop) => shop.id);
                const { data: productsData, error: productsError } = await supabase.from('products').select('count').in('shop', shopIds);

                if (productsError) throw productsError;

                setUserCounts({
                    shops: shopsData?.[0]?.count || 0,
                    products: productsData?.[0]?.count || 0,
                });
            } else {
                setUserCounts({
                    shops: shopsData?.[0]?.count || 0,
                    products: 0,
                });
            }
        } catch (error) {
            console.error('Error fetching license data:', error);
            setError('Failed to load license information. Please try again later.');
        } finally {
            setLoading(false);
        }
    };
    const handleLicenseSwitch = async (licenseId: number) => {
        try {
            setLoading(true);

            // Get current user
            const { user, error: userError } = await getCurrentUser();
            if (userError) throw new Error(userError);
            if (!user) throw new Error('No user found');

            // Use a transaction to ensure either both operations succeed or neither does
            // This prevents the user from having either zero or multiple active subscriptions
            if (currentSubscription) {
                // Use RPC function if available, or create a transaction manually
                const { error: switchError } = await supabase
                    .rpc('switch_license', {
                        old_subscription_id: currentSubscription.id,
                        new_license_id: licenseId,
                        profile_id: user.id,
                    })
                    .single();

                // If the RPC call fails (e.g., if it doesn't exist), handle it without RPC
                if (switchError && switchError.message.includes('does not exist')) {
                    // First create new subscription
                    const { data: newSub, error: insertError } = await supabase
                        .from('subscriptions')
                        .insert({
                            license_id: licenseId,
                            profile_id: user.id,
                            status: 'Active',
                        })
                        .select()
                        .single();

                    if (insertError) throw insertError;

                    // If that succeeds, delete the old one
                    const { error: deleteError } = await supabase.from('subscriptions').delete().eq('id', currentSubscription.id);

                    if (deleteError) {
                        // If deletion failed, we need to delete the new subscription to avoid duplicates
                        await supabase.from('subscriptions').delete().eq('id', newSub.id);
                        throw deleteError;
                    }
                } else if (switchError) {
                    throw switchError;
                }
            } else {
                // If there's no current subscription, simply create a new one
                const { error: insertError } = await supabase.from('subscriptions').insert({
                    license_id: licenseId,
                    profile_id: user.id,
                    status: 'Active',
                });

                if (insertError) throw insertError;
            }

            // Refresh data
            await fetchLicenseData();

            setAlert({
                type: 'success',
                message: 'Your license has been updated successfully!',
            });

            // Clear alert after 5 seconds
            setTimeout(() => {
                setAlert(null);
            }, 5000);
        } catch (error) {
            console.error('Error switching license:', error);
            setAlert({
                type: 'danger',
                message: 'Failed to update your license. Please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    // Calculate usage percentages for shops and products
    const calculateUsagePercentage = (used: number, limit: number) => {
        if (limit === 0) return 100; // Avoid division by zero
        return Math.min(Math.round((used / limit) * 100), 100); // Cap at 100%
    };

    const getProgressBarColor = (percentage: number) => {
        if (percentage < 50) return 'bg-success';
        if (percentage < 80) return 'bg-warning';
        return 'bg-danger';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin border-4 border-primary border-l-transparent rounded-full w-10 h-10"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-danger-light dark:bg-danger/20 text-danger rounded-md p-4">
                <h2 className="text-lg font-semibold mb-2">Error</h2>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className="pt-5">
            {alert && (
                <div className={`mb-6 rounded-md p-4 ${alert.type === 'success' ? 'bg-success-light dark:bg-success/20 text-success' : 'bg-danger-light dark:bg-danger/20 text-danger'}`}>
                    <div className="flex items-center">
                        <span className="ltr:pr-2 rtl:pl-2">
                            {alert.type === 'success' ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                                    <path
                                        d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                    />
                                    <path d="M8 12L11 15L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M12 7V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <circle cx="12" cy="16" r="1" fill="currentColor" />
                                </svg>
                            )}
                        </span>
                        <span>{alert.message}</span>
                    </div>
                </div>
            )}
            <h2 className="text-2xl font-semibold mb-4">Your Current License</h2>{' '}
            {currentSubscription ? (
                <div className="bg-white dark:bg-black p-6 rounded-md shadow-lg border-l-4 border-primary border-t border-r border-b dark:border-t-[#1b2e4b] dark:border-r-[#1b2e4b] dark:border-b-[#1b2e4b] mb-8">
                    <div className="mb-6 flex justify-between items-center">
                        <div className="flex items-center">
                            <div className="h-12 w-12 rounded-md bg-primary-light dark:bg-primary/20 flex items-center justify-center mr-4">
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                                    <path
                                        d="M20.29 8.29L16 4H8L3.71 8.29C3.25 8.74 3 9.37 3 10V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V10C21 9.37 20.75 8.74 20.29 8.29Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <path
                                        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-primary">{currentSubscription.license?.title}</h3>
                                <div className="flex items-center mt-1">
                                    <span className="badge bg-success/20 text-success rounded-full px-3 py-1 text-xs font-semibold">Active</span>
                                    <div className="flex items-center text-gray-500 dark:text-gray-400 ml-3">
                                        <IconCalendar className="w-4 h-4 mr-1" />
                                        <span className="text-sm">Activated on {new Date(currentSubscription.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-primary">${currentSubscription.license?.price.toFixed(2)}</div>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">/month</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Shops Usage */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                            <div className="flex items-center mb-3">
                                <div className="h-10 w-10 rounded-md bg-info-light dark:bg-info/20 flex items-center justify-center mr-3">
                                    <IconShoppingBag className="h-5 w-5 text-info" />
                                </div>
                                <div>
                                    <h5 className="text-base font-semibold">Shops</h5>
                                    <div className="flex items-center">
                                        <span className="font-bold text-lg mr-1">{userCounts.shops}</span>
                                        <span className="text-gray-500 dark:text-gray-400">/ {currentSubscription.license?.shops} Used</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${getProgressBarColor(calculateUsagePercentage(userCounts.shops, currentSubscription.license?.shops || 1))}`}
                                    style={{ width: `${calculateUsagePercentage(userCounts.shops, currentSubscription.license?.shops || 1)}%` }}
                                ></div>
                            </div>
                            <div className="text-right mt-1 text-xs text-gray-500 dark:text-gray-400">{calculateUsagePercentage(userCounts.shops, currentSubscription.license?.shops || 1)}% Used</div>
                        </div>

                        {/* Products Usage */}
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-4">
                            <div className="flex items-center mb-3">
                                <div className="h-10 w-10 rounded-md bg-success-light dark:bg-success/20 flex items-center justify-center mr-3">
                                    <IconShoppingCart className="h-5 w-5 text-success" />
                                </div>
                                <div>
                                    <h5 className="text-base font-semibold">Products</h5>
                                    <div className="flex items-center">
                                        <span className="font-bold text-lg mr-1">{userCounts.products}</span>
                                        <span className="text-gray-500 dark:text-gray-400">/ {currentSubscription.license?.products} Used</span>
                                    </div>
                                </div>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${getProgressBarColor(calculateUsagePercentage(userCounts.products, currentSubscription.license?.products || 1))}`}
                                    style={{ width: `${calculateUsagePercentage(userCounts.products, currentSubscription.license?.products || 1)}%` }}
                                ></div>
                            </div>
                            <div className="text-right mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {calculateUsagePercentage(userCounts.products, currentSubscription.license?.products || 1)}% Used
                            </div>
                        </div>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 mb-4 text-base">{currentSubscription.license?.desc}</p>
                </div>
            ) : (
                <div className="bg-warning-light dark:bg-warning/20 text-warning rounded-md p-4 mb-8">
                    <h3 className="text-lg font-semibold mb-2">No Active License</h3>
                    <p>You don't have an active license. Please select one of the available options below.</p>
                </div>
            )}
            <h2 className="text-2xl font-semibold mb-4">Available License Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableLicenses.map((license) => {
                    const isCurrentPlan = currentSubscription?.license_id === license.id;

                    return (
                        <div
                            key={license.id}
                            className={`p-6 rounded-md shadow border ${
                                isCurrentPlan ? 'border-primary border-2 bg-primary-light dark:bg-primary/10' : 'border-[#e0e6ed] dark:border-[#1b2e4b] bg-white dark:bg-black'
                            } transition-all duration-300`}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold">{license.title}</h3>
                                {isCurrentPlan && <span className="badge bg-primary bg-opacity-20 text-primary rounded-md px-3 py-1 text-xs">Current Plan</span>}
                            </div>
                            <div className="mb-4">
                                <span className="text-3xl font-bold">${license.price.toFixed(2)}</span>
                                <span className="text-gray-500 dark:text-gray-400">/month</span>
                            </div>
                            <div className="mb-6">
                                <p className="text-gray-600 dark:text-gray-400 mb-4">{license.desc}</p>
                                <ul className="space-y-2">
                                    <li className="flex items-center">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success ltr:mr-2 rtl:ml-2">
                                            <path
                                                d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                            />
                                            <path d="M8 12L11 15L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Up to {license.shops} shops</span>
                                    </li>
                                    <li className="flex items-center">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success ltr:mr-2 rtl:ml-2">
                                            <path
                                                d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22Z"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                            />
                                            <path d="M8 12L11 15L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span>Up to {license.products} products</span>
                                    </li>
                                </ul>
                            </div>
                            <button
                                type="button"
                                className={`btn w-full ${isCurrentPlan ? 'btn-outline-primary cursor-not-allowed opacity-50' : 'btn-primary'}`}
                                onClick={() => !isCurrentPlan && handleLicenseSwitch(license.id)}
                                disabled={isCurrentPlan || loading}
                            >
                                {isCurrentPlan ? 'Current License' : 'Switch to this license'}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LicenseManagement;
