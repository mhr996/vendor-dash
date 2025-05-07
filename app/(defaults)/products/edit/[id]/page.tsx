'use client';
import React, { useEffect, useState } from 'react';
import ProductForm from '@/components/products/product-form';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Alert } from '@/components/elements/alerts/elements-alerts-default';

interface EditProductPageProps {
    params: {
        id: string;
    };
}

const EditProductPage = ({ params }: EditProductPageProps) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [unauthorized, setUnauthorized] = useState(false);
    const [alert, setAlert] = useState<{ visible: boolean; message: string; type: 'success' | 'danger' }>({
        visible: false,
        message: '',
        type: 'danger',
    });

    useEffect(() => {
        const checkPermissions = async () => {
            try {
                // Get current user
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                // Get user's role from profiles table
                const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', userData?.user?.id).single();

                if (profileError) throw profileError;

                const isAdmin = profileData?.role === 1;

                // Get product data with shop info to check ownership
                const { data: product, error: productError } = await supabase.from('products').select('shop, shops(owner)').eq('id', params.id).single();

                if (productError) throw productError;

                // Check if user has permission to edit this product
                if (!isAdmin && product.shops.owner !== userData.user.id) {
                    setUnauthorized(true);
                }
            } catch (error: any) {
                console.error('Error checking permissions:', error);
                setAlert({
                    visible: true,
                    message: error.message || 'Error checking permissions',
                    type: 'danger',
                });
                setUnauthorized(true);
            } finally {
                setLoading(false);
            }
        };

        checkPermissions();
    }, [params.id]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (unauthorized) {
        return (
            <div className="container mx-auto p-6">
                <div className="panel">
                    <div className="flex flex-col items-center justify-center p-6">
                        <div className="text-danger mb-4">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="40"
                                height="40"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Unauthorized Access</h2>
                        <p className="text-gray-500 mb-4">You do not have permission to edit this product.</p>
                        <button onClick={() => router.push('/products')} className="btn btn-primary">
                            Return to Products
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            {alert.visible && (
                <div className="mb-4">
                    <Alert type={alert.type} title={alert.type === 'success' ? 'Success' : 'Error'} message={alert.message} onClose={() => setAlert({ ...alert, visible: false })} />
                </div>
            )}

            <div className="flex items-center gap-5 mb-6">
                <div onClick={() => router.back()}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mb-4 cursor-pointer text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </div>

                {/* Breadcrumb Navigation */}
                <ul className="flex space-x-2 rtl:space-x-reverse mb-4">
                    <li>
                        <Link href="/" className="text-primary hover:underline">
                            Home
                        </Link>
                    </li>
                    <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                        <Link href="/products" className="text-primary hover:underline">
                            Products
                        </Link>
                    </li>
                    <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                        <span>Edit Product</span>
                    </li>
                </ul>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">Edit Product</h1>
                <p className="text-gray-500">Update your product information</p>
            </div>

            <ProductForm productId={params.id} />
        </div>
    );
};

export default EditProductPage;
