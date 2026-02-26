export interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  relationship?: string;
}

export interface EmergencyAlert {
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  status: string;
  timestamp: string;
  userName: string;
  nearbyDisasters?: string[];
}
