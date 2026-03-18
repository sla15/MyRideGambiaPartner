import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Toggle } from '../components/Toggle';
import { Product } from '../types';
import { Edit2, Plus, X, Image as ImageIcon, ChevronDown, Upload, Trash2, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const ProductManagement: React.FC = () => {
    const { products, addProduct, updateProduct, deleteProduct, loadProducts, profile, user, uploadFile, showAlert } = useApp();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [businessId, setBusinessId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // New Product Form State
    const [newProduct, setNewProduct] = useState({
        name: '',
        price: '',
        category: '',
        image: '',
        stock: 10,
        isAvailable: true,
        description: ''
    });

    React.useEffect(() => {
        const init = async () => {
            if (!user) return;
            const { data } = await supabase.from('businesses').select('id').eq('owner_id', user.id).single();
            if (data) {
                setBusinessId(data.id);
                await loadProducts(data.id);
            }
            setIsLoading(false);
        };
        init();
    }, [user, loadProducts]);

    // Derived state for categories
    const categories = Array.from(new Set(products.map(p => p.category)));

    // Available Product Groups from Business Profile ONLY (per user request)
    const availableGroups = profile.business?.subCategories || [];

    const toggleAvailability = async (id: string, currentStatus: boolean) => {
        await updateProduct(id, { isAvailable: !currentStatus });
    };

    const updateProductPrice = async (id: string, newPrice: string) => {
        const price = parseFloat(newPrice);
        if (!isNaN(price)) {
            await updateProduct(id, { price });
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            setIsUploadingImage(true);
            try {
                const url = await uploadFile(file, 'products', `${user.id}/${Date.now()}_${file.name}`);
                if (url) {
                    if (editingProduct) {
                        setEditingProduct({ ...editingProduct, image: url });
                    } else {
                        setNewProduct({ ...newProduct, image: url });
                    }
                }
            } finally {
                setIsUploadingImage(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleSaveProduct = async () => {
        if (!businessId) {
            showAlert('Wait!', 'We can\'t find your business. Please refresh or finish your setup.');
            return;
        }

        if (editingProduct) {
            if (!editingProduct.name || !editingProduct.price || !editingProduct.category) {
                showAlert('Missing Info', 'Please fill in Name, Price and Product Group');
                return;
            }
            const success = await updateProduct(editingProduct.id, {
                name: editingProduct.name,
                price: editingProduct.price,
                category: editingProduct.category,
                image: editingProduct.image,
                isAvailable: editingProduct.isAvailable,
                description: editingProduct.description,
                stock: editingProduct.stock
            });
            if (success) {
                setEditingProduct(null);
                setIsModalOpen(false);
            }
        } else {
            if (!newProduct.name || !newProduct.price || !newProduct.category) {
                showAlert('Missing Info', 'Please fill in Name, Price and Product Group');
                return;
            }

            // Task 6: Limit to 10 products
            if (products.length >= 10) {
                showAlert('Limit Reached', 'You can only have 10 products. Please delete an old product to add a new one.');
                return;
            }

            const success = await addProduct({
                name: newProduct.name,
                price: parseFloat(newProduct.price),
                category: newProduct.category,
                image: newProduct.image || '',
                stock: Number(newProduct.stock) || 0,
                isAvailable: newProduct.isAvailable,
                description: newProduct.description
            }, businessId);

            if (success) {
                setIsModalOpen(false);
                setNewProduct({ name: '', price: '', category: '', image: '', stock: 10, isAvailable: true, description: '' });
            } else {
                showAlert('Oops!', 'We couldn\'t add the product. Please check your internet and try again.');
            }
        }
    };

    const handleDeleteProduct = async (id: string) => {
        showAlert('Delete Product?', 'Are you sure you want to delete this from your store?', () => {
            deleteProduct(id);
        });
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-black">
            {/* Fixed Header */}
            <div className="px-6 pt-safe pb-4 flex justify-between items-center bg-gray-50 dark:bg-black shrink-0 z-10">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Products</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-10 h-10 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                >
                    <Plus size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-24 space-y-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center pt-20 gap-4">
                        <div className="w-12 h-12 border-4 border-[#00E39A]/20 border-t-[#00E39A] rounded-full animate-spin" />
                        <p className="text-slate-400 font-bold text-sm">Loading your inventory...</p>
                    </div>
                ) : (
                    categories.map(category => (
                        <div key={category}>
                            <h2 className="text-lg font-bold text-gray-400 mb-4 sticky top-0 bg-gray-50 dark:bg-black py-2 z-0 uppercase tracking-widest text-[11px]">{category}</h2>
                            <div className="space-y-4">
                                {products.filter(p => p.category === category).map((product) => (
                                    <div key={product.id} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-col gap-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-2xl overflow-hidden shrink-0">
                                                    {product.image ? (
                                                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                            <ImageIcon size={24} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white text-base">{product.name}</h3>
                                                    <p className={`text-[10px] font-black uppercase mt-1 ${product.isAvailable ? 'text-green-500' : 'text-red-500'}`}>
                                                        {product.isAvailable ? 'Available' : 'Unavailable'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="relative flex items-center gap-2">
                                                <Toggle checked={product.isAvailable} onChange={() => toggleAvailability(product.id, product.isAvailable)} />
                                                <button
                                                    onClick={() => setActiveMenuId(activeMenuId === product.id ? null : product.id)}
                                                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {activeMenuId === product.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-20" onClick={() => setActiveMenuId(null)} />
                                                        <div className="absolute right-0 top-12 w-48 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-700 overflow-hidden z-30 animate-in fade-in zoom-in duration-200">
                                                            <button
                                                                onClick={() => {
                                                                    openEditModal(product);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-3.5 flex items-center gap-3 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-zinc-750 transition-colors"
                                                            >
                                                                <Edit2 size={16} className="text-blue-500" />
                                                                Edit Product
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    handleDeleteProduct(product.id);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-3.5 flex items-center gap-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                                                            >
                                                                <Trash2 size={16} />
                                                                Delete Product
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/50 p-2 rounded-2xl">
                                            <span className="text-gray-500 text-[11px] font-black uppercase pl-3">Price (D)</span>
                                            <input
                                                type="number"
                                                value={product.price}
                                                onChange={(e) => updateProductPrice(product.id, e.target.value)}
                                                className="bg-transparent font-black text-gray-900 dark:text-white focus:outline-none w-full text-right pr-4"
                                            />
                                            <Edit2 size={14} className="text-gray-400 mr-2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
                {!isLoading && products.length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-20 px-4">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-white dark:bg-zinc-900 border-2 border-dashed border-gray-200 dark:border-zinc-800 p-10 rounded-[40px] flex flex-col items-center gap-6 group active:scale-95 transition-all shadow-sm w-full"
                        >
                            <div className="w-20 h-20 bg-[#00E39A]/10 text-[#00E39A] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Plus size={40} />
                            </div>
                            <div className="text-center">
                                <p className="text-xl font-black text-slate-900 dark:text-white">Build your Store</p>
                                <p className="text-slate-500 font-bold mt-1 text-sm">Add your first item to start selling</p>
                            </div>
                            <div className="bg-[#00E39A] text-slate-900 font-black px-8 py-3 rounded-full text-sm shadow-lg shadow-[#00E39A]/20">
                                Add Product
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Create/Edit Product Bottom Drawer */}
            {isModalOpen && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex flex-col justify-end">
                    <div
                        className="bg-white dark:bg-zinc-900 w-full rounded-t-[2.5rem] p-6 shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-full flex justify-center mb-6" onClick={closeModal}>
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-zinc-700 rounded-full cursor-pointer"></div>
                        </div>

                        <div className="flex justify-between items-center mb-6 shrink-0">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{editingProduct ? 'Edit Product' : 'New Product'}</h2>
                            <button onClick={closeModal} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="overflow-y-auto space-y-4 pb-8 no-scrollbar">
                            {/* Compact Image Uploader */}
                            <div className="flex justify-center mb-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-32 h-32 bg-gray-100 dark:bg-zinc-800 rounded-3xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-zinc-700 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-750 transition-colors overflow-hidden relative"
                                >
                                    {isUploadingImage ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-3 border-[#00E39A]/20 border-t-[#00E39A] rounded-full animate-spin" />
                                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Wait...</span>
                                        </div>
                                    ) : (editingProduct?.image || newProduct.image) ? (
                                        <>
                                            <img src={editingProduct?.image || newProduct.image || undefined} className="h-full w-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <Upload className="text-white" size={20} />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <ImageIcon className="text-gray-400 mb-2 w-6 h-6" />
                                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight px-2 text-center">Add Photo</span>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Product Name</label>
                                <input
                                    type="text"
                                    value={editingProduct ? editingProduct.name : newProduct.name}
                                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, name: e.target.value }) : setNewProduct({ ...newProduct, name: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mt-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00E39A] text-lg"
                                    placeholder="e.g. Chicken Yassa"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase ml-1">Description (Optional)</label>
                                <textarea
                                    value={editingProduct ? editingProduct.description || '' : newProduct.description || ''}
                                    onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, description: e.target.value }) : setNewProduct({ ...newProduct, description: e.target.value })}
                                    className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mt-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00E39A] text-base min-h-[100px] max-h-[160px]"
                                    placeholder="e.g. Served with fresh vegetables and secret sauce"
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Price (GMD)</label>
                                    <input
                                        type="number"
                                        value={editingProduct ? editingProduct.price : newProduct.price}
                                        onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 }) : setNewProduct({ ...newProduct, price: e.target.value })}
                                        className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mt-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00E39A] text-lg"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Product Group</label>
                                    <div className="relative mt-1">
                                        <select
                                            value={editingProduct ? editingProduct.category : newProduct.category}
                                            onChange={(e) => editingProduct
                                                ? setEditingProduct({ ...editingProduct, category: e.target.value })
                                                : setNewProduct({ ...newProduct, category: e.target.value })
                                            }
                                            className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00E39A] text-lg appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>Select Group</option>
                                            {availableGroups.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <ChevronDown size={18} />
                                        </div>
                                    </div>
                                    {availableGroups.length === 0 && (
                                        <p className="text-[10px] text-orange-500 font-bold mt-1.5 ml-1 px-1 leading-tight">
                                            Add groups in Profile &gt; Business Details first
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Initial Stock</label>
                                    <input
                                        type="number"
                                        value={editingProduct ? editingProduct.stock : newProduct.stock}
                                        onChange={(e) => editingProduct ? setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 }) : setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl mt-1 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00E39A] text-lg"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800 p-4 rounded-xl">
                                <span className="text-gray-900 dark:text-white font-medium">Available Immediately</span>
                                <Toggle
                                    checked={editingProduct ? editingProduct.isAvailable : newProduct.isAvailable}
                                    onChange={() => editingProduct ? setEditingProduct({ ...editingProduct, isAvailable: !editingProduct.isAvailable }) : setNewProduct({ ...newProduct, isAvailable: !newProduct.isAvailable })}
                                />
                            </div>

                            <button
                                onClick={handleSaveProduct}
                                className="w-full bg-[#00E39A] text-slate-900 font-black py-5 rounded-3xl mt-4 active:scale-95 transition-transform text-lg shadow-xl"
                            >
                                {editingProduct ? 'Save Changes' : 'Add to Store'}
                            </button>

                            {/* Extra padding for scroll feel */}
                            <div className="h-8"></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};