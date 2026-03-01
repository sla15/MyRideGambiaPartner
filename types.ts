
export type Role = 'DRIVER' | 'MERCHANT' | 'CUSTOMER';

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'arrived' | 'delivering' | 'completed' | 'cancelled';
export type RideStatus = 'IDLE' | 'RINGING' | 'ACCEPTED' | 'ARRIVED' | 'NAVIGATING' | 'COMPLETED';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  isAvailable: boolean;
  image: string;
  category: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  items: { product: Product; quantity: number; checked: boolean }[];
  status: OrderStatus;
  total: number;
  timestamp: Date;
}

export interface RideRequest {
  id: string;
  customer_id?: string;
  passengerName: string;
  passengerPhone?: string;
  passengerImage?: string;
  passengerRating?: number;
  rating: number; // For compatibility with existing code
  rideCount: number;
  pickupDistance: string;
  destination: string;
  price: number;
  pickupLocation: string;
  pickup_lat?: number;
  pickup_lng?: number;
  stops?: string[];
  type?: 'PASSENGER' | 'DELIVERY' | 'MERCHANT_DELIVERY';
  total_cash_upfront?: number;
  current_stop_index?: number;
  merchantPhone?: string;
  businessName?: string;
  merchants?: {
    name: string;
    phone: string;
    amount: number;
    address: string;
  }[];
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  commission: number;
  type: 'RIDE' | 'ORDER' | 'PAYMENT';
  description: string;
}

export interface Review {
  id: string;
  rating: number;
  comment: string;
  date: string;
  reviewerName: string;
}

export interface BusinessDetails {
  id: string;
  businessName: string;
  logo: string;
  category: string;
  workingHours: { start: string; end: string };
  workingDays: string[];
  phone: string;
  website?: string;
  eWallet: 'Wave' | 'Afrimoney' | 'Qmoney' | '';
  subCategories: string[];
  address?: string;
  lat?: number;
  lng?: number;
  paymentPhone?: string;
}

export interface UserProfile {
  name: string;
  age?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  location?: string;
  phone: string;
  email: string;
  image?: string;
  driverProfilePic?: string;
  rating: number;
  commissionDebt: number;
  walletBalance: number;
  isOnline: boolean;
  vehicle?: {
    model: string;
    plate: string;
    color: string;
    type: 'SCOOTER_TUKTUK' | 'ECONOMIC' | 'PREMIUM';
    seats: number;
    hasAC: boolean;
    images: string[];
  };
  business?: BusinessDetails;
  documents: {
    license?: { url: string; status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' };
    idCard?: { url: string; status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' };
    insurance?: { url: string; status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' };
    permit?: { url: string; status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' };
  };
  currentLat?: number;
  currentLng?: number;
  heading?: number;
  isSuspended: boolean;
  deletion_requested_at?: string;
  deleted_at?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'RIDE' | 'ORDER' | 'SYSTEM';
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'ME' | 'OTHER';
  timestamp: Date;
}

export interface ChatSession {
  id: string;
  participantName: string;
  contextId: string;
}
