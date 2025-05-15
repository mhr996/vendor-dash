import LicenseManagement from '@/components/license/license-management';
import { Metadata } from 'next';
import Link from 'next/link';
import React from 'react';

export const metadata: Metadata = {
    title: 'License Management',
};

const LicensePage = () => {
    return (
        <div>
            <ul className="flex space-x-2 rtl:space-x-reverse">
                <li>
                    <Link href="/" className="text-primary hover:underline">
                        Home
                    </Link>
                </li>
                <li className="before:content-['/'] ltr:before:mr-2 rtl:before:ml-2">
                    <span>License Management</span>
                </li>
            </ul>
            <LicenseManagement />
        </div>
    );
};

export default LicensePage;
