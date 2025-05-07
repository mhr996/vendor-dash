'use client';
import IconEdit from '@/components/icon/icon-edit';
import IconEye from '@/components/icon/icon-eye';
import IconPlus from '@/components/icon/icon-plus';
import IconTrashLines from '@/components/icon/icon-trash-lines';
import { sortBy } from 'lodash';
import { DataTableSortStatus, DataTable } from 'mantine-datatable';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { Alert } from '@/components/elements/alerts/elements-alerts-default';
import ConfirmModal from '@/components/modals/confirm-modal';

// Updated shop type reflecting the join with profiles.
interface Shop {
    id: number;
    shop_name: string;
    shop_desc: string;
    logo_url: string | null;
    owner: string;
    public: boolean; // Controls if shop is public or private
    status: string; // Shop status (Pending, Approved, etc.)
    created_at?: string;
    profiles?: {
        full_name: string;
    };
}

const ShopsList = () => {
    const [items, setItems] = useState<Shop[]>([]);
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const PAGE_SIZES = [10, 20, 30, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [initialRecords, setInitialRecords] = useState<Shop[]>([]);
    const [records, setRecords] = useState<Shop[]>([]);
    const [selectedRecords, setSelectedRecords] = useState<any>([]);

    const [search, setSearch] = useState('');
    const [sortStatus, setSortStatus] = useState<DataTableSortStatus>({
        columnAccessor: 'shop_name',
        direction: 'asc',
    });

    // New state for confirm modal and alert.
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);
    const [alert, setAlert] = useState<{ visible: boolean; message: string; type: 'success' | 'danger' }>({
        visible: false,
        message: '',
        type: 'success',
    });

    useEffect(() => {
        const fetchShops = async () => {
            try {
                // Get current user
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError) throw userError;

                if (!userData?.user?.id) {
                    throw new Error('User not authenticated');
                }

                // Get the user's role from the profiles table
                const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single();

                if (profileError) throw profileError;

                const isAdmin = profileData?.role === 1;

                let shopsQuery = supabase.from('shops').select('*, profiles(full_name)');

                // If not admin, filter to only show user's own shops
                if (!isAdmin) {
                    shopsQuery = shopsQuery.eq('owner', userData.user.id);
                }

                const { data, error } = await shopsQuery;
                if (error) throw error;
                setItems(data as Shop[]);
            } catch (error) {
                console.error('Error fetching shops:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchShops();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [pageSize]);

    useEffect(() => {
        const from = (page - 1) * pageSize;
        const to = from + pageSize;
        setRecords([...initialRecords.slice(from, to)]);
    }, [page, pageSize, initialRecords]);

    useEffect(() => {
        setInitialRecords(
            items.filter((item) => {
                const searchTerm = search.toLowerCase();
                return (
                    item.shop_name.toLowerCase().includes(searchTerm) ||
                    // Also search owner name if available.
                    (item.profiles?.full_name.toLowerCase().includes(searchTerm) ?? false)
                );
            }),
        );
    }, [items, search]);

    useEffect(() => {
        const sorted = sortBy(initialRecords, sortStatus.columnAccessor as keyof Shop);
        setRecords(sortStatus.direction === 'desc' ? sorted.reverse() : sorted);
        setPage(1);
    }, [sortStatus, initialRecords]);

    const deleteRow = (id: number | null = null) => {
        if (id) {
            const shop = items.find((s) => s.id === id);
            if (shop) {
                setShopToDelete(shop);
                setShowConfirmModal(true);
            }
        }
    };

    // Confirm deletion callback.
    const confirmDeletion = async () => {
        if (!shopToDelete || !shopToDelete.id) return;
        try {
            // Get current user
            const { data: userData } = await supabase.auth.getUser();

            // Verify ownership before deletion
            const { data: shop, error: shopError } = await supabase.from('shops').select('owner').eq('id', shopToDelete.id).single();

            if (shopError) throw shopError;

            // Check if user is owner or admin
            const { data: profileData } = await supabase.from('profiles').select('role').eq('id', userData?.user?.id).single();

            const isAdmin = profileData?.role === 1;

            if (!isAdmin && shop.owner !== userData?.user?.id) {
                throw new Error('You do not have permission to delete this shop');
            }

            // Clean up storage folders first
            try {
                // 1. Delete all files in the shop's folder in the shops-logos bucket
                const { data: logoFiles } = await supabase.storage.from('shops-logos').list(shopToDelete.id.toString());

                if (logoFiles && logoFiles.length > 0) {
                    await supabase.storage.from('shops-logos').remove(logoFiles.map((file) => `${shopToDelete.id}/${file.name}`));
                }

                // 2. Delete folder placeholder
                await supabase.storage.from('shops-logos').remove([`${shopToDelete.id}/.folder`]);

                // 3. Check for files in the shop-gallery bucket
                const { data: galleryFiles } = await supabase.storage.from('shop-gallery').list(shopToDelete.id.toString());

                if (galleryFiles && galleryFiles.length > 0) {
                    await supabase.storage.from('shop-gallery').remove(galleryFiles.map((file) => `${shopToDelete.id}/${file.name}`));
                }

                // 4. Check for cover images
                const { data: coverFiles } = await supabase.storage.from('shops-logos').list(`covers/${shopToDelete.id}`);

                if (coverFiles && coverFiles.length > 0) {
                    await supabase.storage.from('shops-logos').remove(coverFiles.map((file) => `covers/${shopToDelete.id}/${file.name}`));
                }
            } catch (storageError) {
                console.error('Error cleaning up shop storage:', storageError);
                // Continue with deletion even if storage cleanup fails
            }

            // Delete shop record from the database
            const { error } = await supabase.from('shops').delete().eq('id', shopToDelete.id);
            if (error) throw error;
            const updatedItems = items.filter((s) => s.id !== shopToDelete.id);
            setItems(updatedItems);
            setAlert({ visible: true, message: 'Shop deleted successfully.', type: 'success' });
        } catch (error) {
            console.error('Deletion error:', error);
            setAlert({ visible: true, message: 'Error deleting shop.', type: 'danger' });
        } finally {
            setShowConfirmModal(false);
            setShopToDelete(null);
        }
    };

    return (
        <div className="panel border-white-light px-0 dark:border-[#1b2e4b]">
            {/* Alert */}
            {alert.visible && (
                <div className="mb-4 ml-4 max-w-96">
                    <Alert
                        type={alert.type}
                        title={alert.type === 'success' ? 'Success' : 'Error'}
                        message={alert.message}
                        onClose={() => setAlert({ visible: false, message: '', type: 'success' })}
                    />
                </div>
            )}
            <div className="invoice-table">
                <div className="mb-4.5 flex flex-col gap-5 px-5 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                        <button type="button" className="btn btn-danger gap-2">
                            <IconTrashLines />
                            Delete
                        </button>
                        <Link href="/shops/add" className="btn btn-primary gap-2">
                            <IconPlus />
                            Add New
                        </Link>
                    </div>
                    <div className="ltr:ml-auto rtl:mr-auto">
                        <input type="text" className="form-input w-auto" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>

                <div className="datatables pagination-padding relative">
                    <DataTable
                        className={`${loading ? 'filter blur-sm pointer-events-none' : 'table-hover whitespace-nowrap'}`}
                        records={records}
                        columns={[
                            {
                                accessor: 'id',
                                title: 'ID',
                                sortable: true,
                                render: ({ id }) => <strong className="text-info">#{id}</strong>,
                            },
                            {
                                accessor: 'shop_name',
                                title: 'Shop Name',
                                sortable: true,
                                render: ({ shop_name, logo_url }) => (
                                    <div className="flex items-center font-semibold">
                                        <div className="w-max rounded-full ltr:mr-2 rtl:ml-2 flex items-center justify-center">
                                            <img className="h-8 w-8 rounded-full object-cover" src={logo_url || `/assets/images/shop-placeholder.jpg`} alt="" />
                                        </div>
                                        <div>{shop_name}</div>
                                    </div>
                                ),
                            },
                            {
                                accessor: 'owner',
                                title: 'Owner',
                                sortable: true,
                                render: ({ owner, profiles }) => <span>{profiles ? profiles.full_name : owner}</span>,
                            },
                            {
                                accessor: 'created_at',
                                title: 'Registration Date',
                                sortable: true,
                                render: ({ created_at }) => (created_at ? <span>{new Date(created_at).toLocaleDateString('TR')}</span> : ''),
                            },
                            {
                                accessor: 'status',
                                title: 'Status',
                                sortable: true,
                                render: ({ status }) => {
                                    let statusClass = 'warning';
                                    if (status === 'Approved') statusClass = 'success';
                                    else if (status === 'Rejected') statusClass = 'danger';

                                    return <span className={`badge badge-outline-${statusClass}`}>{status || 'Pending'}</span>;
                                },
                            },
                            {
                                accessor: 'visibility',
                                title: 'Visibility',
                                sortable: true,
                                render: ({ public: isPublic }) => <span className={`badge badge-outline-${isPublic ? 'success' : 'danger'}`}>{isPublic ? 'Public' : 'Private'}</span>,
                            },
                            {
                                accessor: 'action',
                                title: 'Actions',
                                sortable: false,
                                textAlignment: 'center',
                                render: ({ id }) => (
                                    <div className="mx-auto flex w-max items-center gap-4">
                                        <Link href={`/shops/edit/${id}`} className="flex hover:text-info">
                                            <IconEdit className="h-4.5 w-4.5" />
                                        </Link>
                                        <Link href={`/shops/preview/${id}`} className="flex hover:text-primary">
                                            <IconEye />
                                        </Link>
                                        <button type="button" className="flex hover:text-danger" onClick={() => deleteRow(id)}>
                                            <IconTrashLines />
                                        </button>
                                    </div>
                                ),
                            },
                        ]}
                        highlightOnHover
                        totalRecords={initialRecords.length}
                        recordsPerPage={pageSize}
                        page={page}
                        onPageChange={(p) => setPage(p)}
                        recordsPerPageOptions={PAGE_SIZES}
                        onRecordsPerPageChange={setPageSize}
                        sortStatus={sortStatus}
                        onSortStatusChange={setSortStatus}
                        selectedRecords={selectedRecords}
                        onSelectedRecordsChange={setSelectedRecords}
                        paginationText={({ from, to, totalRecords }) => `Showing ${from} to ${to} of ${totalRecords} entries`}
                        minHeight={300}
                    />

                    {loading && <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-black-dark-light bg-opacity-60 backdrop-blur-sm" />}
                </div>
            </div>

            {/* Confirm Deletion Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title="Confirm Deletion"
                message="Are you sure you want to delete this shop?"
                onCancel={() => {
                    setShowConfirmModal(false);
                    setShopToDelete(null);
                }}
                onConfirm={confirmDeletion}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                size="sm"
            />
        </div>
    );
};

export default ShopsList;
