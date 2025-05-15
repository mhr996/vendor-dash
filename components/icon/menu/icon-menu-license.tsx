import { FC } from 'react';

interface IconMenuLicenseProps {
    className?: string;
    fill?: boolean;
}

const IconMenuLicense: FC<IconMenuLicenseProps> = ({ className = '', fill = false }) => {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <path
                d="M20.29 8.29L16 4H8L3.71 8.29C3.25 8.74 3 9.37 3 10V18C3 19.1 3.9 20 5 20H19C20.1 20 21 19.1 21 18V10C21 9.37 20.75 8.74 20.29 8.29Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={fill ? 'currentColor' : 'none'}
            />
            <path
                d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={fill ? 'currentColor' : 'none'}
            />
        </svg>
    );
};

export default IconMenuLicense;
