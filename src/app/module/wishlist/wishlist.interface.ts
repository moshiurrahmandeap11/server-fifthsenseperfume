export interface IToggleWishlistPayload {
    productId: string;
}

export interface IToggleWishlistResult {
    inWishlist: boolean;
    productId: string;
    message: string;
}

