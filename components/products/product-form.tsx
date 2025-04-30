'use client';
import { Alert } from '@/components/elements/alerts/elements-alerts-default';
import React, { useEffect, useState, useRef } from 'react';
import supabase from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import IconX from '@/components/icon/icon-x';
import IconCaretDown from '@/components/icon/icon-caret-down';
import IconUpload from '@/components/icon/icon-camera';
import IconCalendar from '@/components/icon/icon-calendar';
import AnimateHeight from 'react-animate-height';
import { useSelector } from 'react-redux';
import { IRootState } from '@/store';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.css';

interface Shop {
    id: string;
    shop_name: string;
}

interface Category {
    id: number;
    title: string;
    desc: string;
}

interface ProductFormProps {
    productId?: string; // If provided, we're editing an existing product
}

const ProductForm: React.FC<ProductFormProps> = ({ productId }) => {
    const router = useRouter();
    const isRtl = useSelector((state: IRootState) => state.themeConfig.rtlClass) === 'rtl';
    const [loading, setLoading] = useState(false);
    const [shops, setShops] = useState<Shop[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [alert, setAlert] = useState<{ type: 'success' | 'danger'; message: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sale price states
    const [hasSalePrice, setHasSalePrice] = useState(false);
    const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
    const [discountValue, setDiscountValue] = useState('');
    const [finalPrice, setFinalPrice] = useState<number | null>(null);
    const [discountStart, setDiscountStart] = useState<Date | null>(null);
    const [discountEnd, setDiscountEnd] = useState<Date | null>(null);

    // Dropdown states
    const [isShopDropdownOpen, setIsShopDropdownOpen] = useState(false);
    const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState({ shop: '', category: '' });
    const shopRef = useRef<HTMLDivElement>(null);
    const categoryRef = useRef<HTMLDivElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        desc: '',
        price: '',
        shop: '',
        category: '',
        active: true, // Default to active
    });

    // New category form state
    const [newCategory, setNewCategory] = useState({
        title: '',
        desc: '',
    });
    const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (shopRef.current && !shopRef.current.contains(event.target as Node)) {
                setIsShopDropdownOpen(false);
            }
            if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
                setIsCategoryDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch user's shops
                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user) {
                    const { data: userShops } = await supabase.from('shops').select('id, shop_name').eq('owner', userData.user.id);
                    if (userShops) setShops(userShops);
                }

                // Fetch categories
                const { data: categoriesData } = await supabase.from('categories').select('*').order('title', { ascending: true });
                if (categoriesData) setCategories(categoriesData);

                // If editing, fetch product data
                if (productId) {
                    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();

                    if (product) {
                        setFormData({
                            title: product.title,
                            desc: product.desc,
                            price: product.price,
                            shop: product.shop,
                            category: product.category?.toString() || '',
                            active: product.active !== undefined ? product.active : true,
                        });
                        setPreviewUrls(product.images || []);

                        // Set sale price state if available
                        if (product.sale_price) {
                            setHasSalePrice(true);
                            setFinalPrice(product.sale_price);

                            // Determine discount type and value
                            if (product.discount_type === 'percentage') {
                                setDiscountType('percentage');
                                setDiscountValue(product.discount_value?.toString() || '');
                            } else {
                                setDiscountType('fixed');
                                setDiscountValue(product.discount_value?.toString() || '');
                            }

                            // Set discount time period if available
                            if (product.discount_start) {
                                setDiscountStart(new Date(product.discount_start));
                            }

                            if (product.discount_end) {
                                setDiscountEnd(new Date(product.discount_end));
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                setAlert({ type: 'danger', message: 'Error loading data' });
            }
        };

        fetchData();
    }, [productId]);

    // Calculate discount price whenever price or discount changes
    useEffect(() => {
        if (hasSalePrice && formData.price && discountValue) {
            const basePrice = parseFloat(formData.price);
            if (discountType === 'percentage') {
                const percentage = parseFloat(discountValue);
                if (percentage >= 0 && percentage <= 100) {
                    const discountAmount = basePrice * (percentage / 100);
                    setFinalPrice(parseFloat((basePrice - discountAmount).toFixed(2)));
                } else {
                    setFinalPrice(null);
                }
            } else {
                const fixedDiscount = parseFloat(discountValue);
                if (fixedDiscount >= 0 && fixedDiscount < basePrice) {
                    setFinalPrice(parseFloat((basePrice - fixedDiscount).toFixed(2)));
                } else {
                    setFinalPrice(null);
                }
            }
        } else {
            setFinalPrice(null);
        }
    }, [hasSalePrice, formData.price, discountType, discountValue]);

    const handleFileSelect = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length + previewUrls.length > 10) {
            setAlert({ type: 'danger', message: 'Maximum 10 images allowed' });
            return;
        }
        setSelectedFiles((prev) => [...prev, ...files]);

        // Generate preview URLs
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrls((prev) => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
        setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    };

    const filteredShops = shops.filter((shop) => shop.shop_name.toLowerCase().includes(searchTerm.shop.toLowerCase()));

    const filteredCategories = categories.filter((category) => category.title.toLowerCase().includes(searchTerm.category.toLowerCase()));

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data, error } = await supabase.from('categories').insert([newCategory]).select().single();

            if (error) throw error;

            setCategories((prev) => [...prev, data]);
            setFormData((prev) => ({ ...prev, category: data.id.toString() }));
            setShowNewCategoryForm(false);
            setNewCategory({ title: '', desc: '' });
            setAlert({ type: 'success', message: 'Category created successfully' });
        } catch (error) {
            console.error('Error creating category:', error);
            setAlert({ type: 'danger', message: 'Error creating category' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate required fields
        if (!formData.title?.trim()) {
            setAlert({ type: 'danger', message: 'Title is required' });
            return;
        }

        if (!formData.price) {
            setAlert({ type: 'danger', message: 'Price is required' });
            return;
        }

        if (!formData.shop) {
            setAlert({ type: 'danger', message: 'You must select a shop' });
            return;
        }

        if (!previewUrls.length && !selectedFiles.length) {
            setAlert({ type: 'danger', message: 'At least one product image is required' });
            return;
        }

        // Validate sale price if enabled
        if (hasSalePrice) {
            if (!discountValue || parseFloat(discountValue) <= 0) {
                setAlert({ type: 'danger', message: 'Please enter a valid discount value' });
                return;
            }

            if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
                setAlert({ type: 'danger', message: 'Percentage discount cannot exceed 100%' });
                return;
            }

            if (discountType === 'fixed' && parseFloat(discountValue) >= parseFloat(formData.price)) {
                setAlert({ type: 'danger', message: 'Fixed discount cannot be equal to or greater than the product price' });
                return;
            }
        }

        setLoading(true);
        try {
            // Upload images first
            const imageUrls: string[] = [];

            // Only upload new files
            if (selectedFiles.length) {
                for (const file of selectedFiles) {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

                    const { error: uploadError } = await supabase.storage.from('products').upload(fileName, file);

                    if (uploadError) throw uploadError;

                    const {
                        data: { publicUrl },
                    } = supabase.storage.from('products').getPublicUrl(fileName);

                    imageUrls.push(publicUrl);
                }
            }

            // Add any existing image URLs (from editing)
            for (const url of previewUrls) {
                // Only add if it's already a URL (not a base64 string)
                if (typeof url === 'string' && url.startsWith('http')) {
                    imageUrls.push(url);
                }
            } //

            const productData = {
                title: formData.title,
                desc: formData.desc,
                price: parseFloat(formData.price),
                shop: formData.shop,
                category: formData.category ? parseInt(formData.category) : null,
                images: imageUrls,
                sale_price: hasSalePrice && finalPrice ? finalPrice : null,
                discount_type: hasSalePrice ? discountType : null,
                discount_value: hasSalePrice && discountValue ? parseFloat(discountValue) : null,
                discount_start: hasSalePrice && discountStart ? discountStart.toISOString() : null,
                discount_end: hasSalePrice && discountEnd ? discountEnd.toISOString() : null,
                active: formData.active,
            };

            if (productId) {
                try {
                    // First try with a direct update
                    const { error } = await supabase.from('products').update(productData).eq('id', productId);

                    if (error) throw error;

                    // Wait a moment to ensure the update is processed
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    // Check if the update was successful by fetching the product separately
                    const { data: updatedProduct, error: fetchError } = await supabase.from('products').select('*').eq('id', productId).single();

                    if (fetchError) throw fetchError;

                    // Check if the data was actually updated
                    if (updatedProduct.title !== productData.title || updatedProduct.desc !== productData.desc || updatedProduct.price !== productData.price) {
                        console.log('Data mismatch detected, trying upsert instead');

                        // If the data doesn't match, try an upsert operation instead
                        const { error: upsertError } = await supabase.from('products').upsert({
                            id: parseInt(productId),
                            ...productData,
                        });

                        if (upsertError) throw upsertError;

                        // Verify the upsert worked
                        const { data: upsertedProduct, error: upsertFetchError } = await supabase.from('products').select('*').eq('id', productId).single();

                        if (upsertFetchError) throw upsertFetchError;

                        console.log('Upserted product data:', upsertedProduct);

                        // Update form with upserted data
                        setFormData({
                            title: upsertedProduct.title,
                            desc: upsertedProduct.desc,
                            price: upsertedProduct.price.toString(),
                            shop: upsertedProduct.shop,
                            category: upsertedProduct.category?.toString() || '',
                            active: upsertedProduct.active,
                        });
                        setPreviewUrls(upsertedProduct.images || []);

                        // Update sale price data
                        if (upsertedProduct.sale_price) {
                            setHasSalePrice(true);
                            setFinalPrice(upsertedProduct.sale_price);
                            setDiscountType(upsertedProduct.discount_type);
                            setDiscountValue(upsertedProduct.discount_value?.toString() || '');
                        } else {
                            setHasSalePrice(false);
                            setFinalPrice(null);
                            setDiscountValue('');
                        }
                    } else {
                        setFormData({
                            title: updatedProduct.title,
                            desc: updatedProduct.desc,
                            price: updatedProduct.price.toString(),
                            shop: updatedProduct.shop,
                            category: updatedProduct.category?.toString() || '',
                            active: updatedProduct.active,
                        });
                        setPreviewUrls(updatedProduct.images || []);

                        // Update sale price data
                        if (updatedProduct.sale_price) {
                            setHasSalePrice(true);
                            setFinalPrice(updatedProduct.sale_price);
                            setDiscountType(updatedProduct.discount_type);
                            setDiscountValue(updatedProduct.discount_value?.toString() || '');
                        } else {
                            setHasSalePrice(false);
                            setFinalPrice(null);
                            setDiscountValue('');
                        }
                    }
                } catch (error) {
                    console.error('Error updating product:', error);
                    throw error;
                }
            } else {
                // Create new product
                const { error } = await supabase.from('products').insert([productData]);
                if (error) throw error;
            }

            setAlert({ type: 'success', message: `Product ${productId ? 'updated' : 'created'} successfully` });
            // Reset form if creating new product
            if (!productId) {
                setFormData({
                    title: '',
                    desc: '',
                    price: '',
                    shop: '',
                    category: '',
                    active: true,
                });
                setSelectedFiles([]);
                setPreviewUrls([]);
                setHasSalePrice(false);
                setDiscountValue('');
                setFinalPrice(null);

                // Redirect to products page after creating a new product
                setTimeout(() => {
                    router.push('/products');
                }, 1500); // Short delay to allow user to see success message
            }
        } catch (error) {
            console.error('Error saving product:', error);
            setAlert({ type: 'danger', message: error instanceof Error ? error.message : 'Error saving product' });
        } finally {
            setLoading(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="panel">
            {alert && <Alert type={alert.type} title={alert.type === 'success' ? 'Success' : 'Error'} message={alert.message} onClose={() => setAlert(null)} />}

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-5">
                        <div>
                            <label htmlFor="title">Title</label>
                            <input
                                id="title"
                                type="text"
                                name="title"
                                className="form-input"
                                value={formData.title}
                                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="price">Price</label>
                            <input
                                id="price"
                                type="number"
                                name="price"
                                step="0.01"
                                className="form-input"
                                value={formData.price}
                                onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                                required
                            />
                        </div>

                        {/* Sale Price Toggle and Options */}
                        <div className="space-y-4 border-2 border-dashed border-gray-200 p-4 rounded-lg dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <label htmlFor="hasSalePrice" className="font-medium flex items-center cursor-pointer">
                                    <input
                                        id="hasSalePrice"
                                        type="checkbox"
                                        className="form-checkbox mr-2"
                                        checked={hasSalePrice}
                                        onChange={(e) => {
                                            setHasSalePrice(e.target.checked);
                                            if (!e.target.checked) {
                                                setDiscountValue('');
                                                setFinalPrice(null);
                                            }
                                        }}
                                    />
                                    Add Sale Price
                                </label>
                            </div>

                            <AnimateHeight duration={300} height={hasSalePrice ? 'auto' : 0}>
                                {hasSalePrice && (
                                    <div className="space-y-4 mt-2">
                                        <div>
                                            <label className="block mb-2">Discount Type</label>
                                            <div className="flex gap-4">
                                                <label className="inline-flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        className="form-radio"
                                                        name="discountType"
                                                        checked={discountType === 'percentage'}
                                                        onChange={() => setDiscountType('percentage')}
                                                    />
                                                    <span className="ml-2">Percentage (%)</span>
                                                </label>
                                                <label className="inline-flex items-center cursor-pointer">
                                                    <input type="radio" className="form-radio" name="discountType" checked={discountType === 'fixed'} onChange={() => setDiscountType('fixed')} />
                                                    <span className="ml-2">Fixed Amount</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="discountValue">{discountType === 'percentage' ? 'Percentage Discount (%)' : 'Fixed Discount Amount'}</label>
                                            <input
                                                id="discountValue"
                                                type="number"
                                                name="discountValue"
                                                step="0.01"
                                                className="form-input"
                                                value={discountValue}
                                                onChange={(e) => setDiscountValue(e.target.value)}
                                                min="0"
                                                max={discountType === 'percentage' ? '100' : formData.price || '999999'}
                                                required={hasSalePrice}
                                            />
                                        </div>

                                        {finalPrice !== null && formData.price && (
                                            <div className="flex items-center gap-4 text-lg">
                                                <div className="font-medium">Final Price:</div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-danger line-through">{parseFloat(formData.price).toFixed(2)}</span>
                                                    <span className="font-bold text-success">{finalPrice.toFixed(2)}</span>
                                                    {discountType === 'percentage' && <span className="bg-success text-white px-2 py-0.5 text-xs rounded-full">{discountValue}% OFF</span>}
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label htmlFor="discountStart">Discount Start Date/Time</label>
                                                <div className="relative">
                                                    <Flatpickr
                                                        options={{
                                                            enableTime: true,
                                                            dateFormat: 'Y-m-d H:i',
                                                            minDate: 'today',
                                                            position: isRtl ? 'auto right' : 'auto left',
                                                            static: true,
                                                            disableMobile: true,
                                                            time_24hr: true,
                                                        }}
                                                        className="form-input text-sm pr-10"
                                                        value={discountStart || ''}
                                                        onChange={([date]) => setDiscountStart(date)}
                                                    />
                                                    <div className="absolute right-[11px] top-1/2 -translate-y-1/2">
                                                        <IconCalendar className="text-neutral-300 dark:text-neutral-600" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label htmlFor="discountEnd">Discount End Date/Time</label>
                                                <div className="relative">
                                                    <Flatpickr
                                                        options={{
                                                            enableTime: true,
                                                            dateFormat: 'Y-m-d H:i',
                                                            minDate: discountStart || 'today',
                                                            position: isRtl ? 'auto right' : 'auto left',
                                                            static: true,
                                                            disableMobile: true,
                                                            time_24hr: true,
                                                        }}
                                                        className="form-input text-sm pr-10"
                                                        value={discountEnd || ''}
                                                        onChange={([date]) => setDiscountEnd(date)}
                                                    />
                                                    <div className="absolute right-[11px] top-1/2 -translate-y-1/2">
                                                        <IconCalendar className="text-neutral-300 dark:text-neutral-600" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </AnimateHeight>
                        </div>

                        <div>
                            <label htmlFor="desc">Description (Optional)</label>
                            <textarea
                                id="desc"
                                name="desc"
                                className="form-textarea min-h-[130px]"
                                value={formData.desc}
                                onChange={(e) => setFormData((prev) => ({ ...prev, desc: e.target.value }))}
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">Product Status</label>
                            <label className="inline-flex cursor-pointer items-center">
                                <input type="checkbox" className="form-checkbox" checked={formData.active} onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))} />
                                <span className="relative text-white-dark checked:bg-none ml-2">{formData.active ? 'Active' : 'Inactive'}</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* Shop Dropdown */}
                        <div ref={shopRef} className="relative">
                            <label htmlFor="shop">Shop</label>
                            <div className="relative">
                                <div
                                    className="cursor-pointer rounded border border-[#e0e6ed] bg-white p-2.5 text-dark dark:border-[#191e3a] dark:bg-black dark:text-white-dark flex items-center justify-between"
                                    onClick={() => setIsShopDropdownOpen(!isShopDropdownOpen)}
                                >
                                    <span>{formData.shop ? shops.find((s) => s.id === formData.shop)?.shop_name : 'Select a shop'}</span>
                                    <IconCaretDown className={`h-4 w-4 transition-transform duration-300 ${isShopDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isShopDropdownOpen && (
                                    <div className="absolute z-50 mt-1 w-full rounded-md border border-[#e0e6ed] bg-white shadow-lg dark:border-[#191e3a] dark:bg-black">
                                        <div className="p-2">
                                            <input
                                                type="text"
                                                className="w-full rounded border border-[#e0e6ed] p-2 focus:border-primary focus:outline-none dark:border-[#191e3a] dark:bg-black dark:text-white-dark"
                                                placeholder="Search..."
                                                value={searchTerm.shop}
                                                onChange={(e) => setSearchTerm((prev) => ({ ...prev, shop: e.target.value }))}
                                            />
                                        </div>
                                        <div className="max-h-64 overflow-y-auto">
                                            {filteredShops.map((shop) => (
                                                <div
                                                    key={shop.id}
                                                    className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:text-white-dark dark:hover:bg-[#191e3a]"
                                                    onClick={() => {
                                                        setFormData((prev) => ({ ...prev, shop: shop.id }));
                                                        setIsShopDropdownOpen(false);
                                                    }}
                                                >
                                                    {shop.shop_name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Category Selection */}
                        <div ref={categoryRef} className="relative">
                            <label htmlFor="category">Category (Optional)</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <div
                                        className="cursor-pointer rounded border border-[#e0e6ed] bg-white p-2.5 text-dark dark:border-[#191e3a] dark:bg-black dark:text-white-dark flex items-center justify-between"
                                        onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                                    >
                                        <span>{formData.category ? categories.find((c) => c.id.toString() === formData.category)?.title : 'Select a category'}</span>
                                        <IconCaretDown className={`h-4 w-4 transition-transform duration-300 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {isCategoryDropdownOpen && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md border border-[#e0e6ed] bg-white shadow-lg dark:border-[#191e3a] dark:bg-black">
                                            <div className="p-2">
                                                <input
                                                    type="text"
                                                    className="w-full rounded border border-[#e0e6ed] p-2 focus:border-primary focus:outline-none dark:border-[#191e3a] dark:bg-black dark:text-white-dark"
                                                    placeholder="Search..."
                                                    value={searchTerm.category}
                                                    onChange={(e) => setSearchTerm((prev) => ({ ...prev, category: e.target.value }))}
                                                />
                                            </div>
                                            <div className="max-h-64 overflow-y-auto">
                                                {filteredCategories.map((category) => (
                                                    <div
                                                        key={category.id}
                                                        className={`cursor-pointer px-4 py-2 hover:bg-gray-100 dark:text-white-dark dark:hover:bg-[#191e3a]`}
                                                        onClick={() => {
                                                            setFormData((prev) => ({ ...prev, category: category.id.toString() }));
                                                            setIsCategoryDropdownOpen(false);
                                                        }}
                                                    >
                                                        {category.title}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <button type="button" className="btn btn-primary" onClick={() => setShowNewCategoryForm(!showNewCategoryForm)}>
                                    New Category
                                </button>
                            </div>
                        </div>

                        {/* Animated New Category Form */}
                        <AnimateHeight duration={300} height={showNewCategoryForm ? 'auto' : 0}>
                            {showNewCategoryForm && (
                                <div className="rounded-lg border border-[#e0e6ed] p-4 dark:border-[#1b2e4b]">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className="text-lg font-semibold">Create New Category</h3>
                                        <button type="button" className="hover:text-danger" onClick={() => setShowNewCategoryForm(false)}>
                                            <IconX className="h-5 w-5" />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <label htmlFor="categoryTitle">Category Title</label>
                                            <input
                                                id="categoryTitle"
                                                type="text"
                                                className="form-input"
                                                name="title"
                                                value={newCategory.title}
                                                onChange={(e) => setNewCategory((prev) => ({ ...prev, title: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="categoryDesc">Category Description</label>
                                            <textarea
                                                id="categoryDesc"
                                                className="form-textarea"
                                                name="desc"
                                                placeholder="Optional"
                                                value={newCategory.desc}
                                                onChange={(e) => setNewCategory((prev) => ({ ...prev, desc: e.target.value }))}
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button type="button" className="btn btn-success" onClick={handleCreateCategory}>
                                                Create Category
                                            </button>
                                            <button type="button" className="btn btn-danger" onClick={() => setShowNewCategoryForm(false)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </AnimateHeight>

                        {/* Image Upload */}
                        <div>
                            <label className="mb-3 block">Product Images</label>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {/* Add New Image Button */}
                                {previewUrls.length < 5 && (
                                    <div
                                        onClick={handleFileSelect}
                                        className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-primary hover:bg-gray-100 dark:border-[#1b2e4b] dark:bg-black dark:hover:border-primary dark:hover:bg-[#1b2e4b]"
                                    >
                                        <IconUpload className="mb-2 h-6 w-6" />
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Click to upload</p>
                                        <p className="text-[10px] text-gray-500 dark:text-gray-500">PNG, JPG, GIF up to 2MB</p>
                                    </div>
                                )}

                                {/* Image Previews */}
                                {previewUrls.map((url, index) => (
                                    <div key={index} className="group relative h-32">
                                        <img src={url} alt={`Preview ${index + 1}`} className="h-full w-full rounded-lg object-cover" />
                                        <button
                                            type="button"
                                            className="absolute right-0 top-0 hidden rounded-full bg-red-500 p-1 text-white hover:bg-red-600 group-hover:block"
                                            onClick={() => removeImage(index)}
                                        >
                                            <IconX className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">First image will be used as the product thumbnail.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <button type="button" className="btn btn-outline-danger" onClick={() => router.push('/products')} disabled={loading}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Saving...' : productId ? 'Update Product' : 'Create Product'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProductForm;
