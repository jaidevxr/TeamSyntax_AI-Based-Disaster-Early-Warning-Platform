import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Navigation, Phone, Clock, MapPin } from 'lucide-react';
import type { Location } from '@/types';

const Emergency = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [routeInfo, setRouteInfo] = useState<{
    distance: string;
    duration: string;
    steps: string[];
  } | null>(null);

  const { origin, destination } = location.state || {};

  useEffect(() => {
    if (!origin || !destination) {
      navigate('/');
      return;
    }

    // Calculate route info
    calculateRoute();
  }, [origin, destination, navigate]);

  const calculateRoute = async () => {
    try {
      // Use OSRM API for routing
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&steps=true`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 'Ok' && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        
        const steps = route.legs[0].steps.map((step: any) => {
          return step.maneuver.instruction || 'Continue';
        });

        setRouteInfo({
          distance: `${distanceKm} km`,
          duration: `${durationMin} min`,
          steps: steps.slice(0, 10), // Show first 10 steps
        });
      }
    } catch (error) {
      console.error('Error calculating route:', error);
      // Fallback to simple distance calculation
      const R = 6371; // Earth's radius in km
      const dLat = (destination.lat - origin.lat) * Math.PI / 180;
      const dLon = (destination.lng - origin.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      setRouteInfo({
        distance: `${distance.toFixed(1)} km`,
        duration: `${Math.round(distance / 40 * 60)} min`, // Approximate at 40 km/h
        steps: ['Navigate to destination using the map'],
      });
    }
  };

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  if (!origin || !destination) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border/40 p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Emergency Navigation</h1>
              <p className="text-sm text-muted-foreground">Route to {destination.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Route Info Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* ETA and Distance Card */}
          <Card className="p-6 bg-card border-border/40">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Destination</p>
                  <p className="font-semibold text-foreground">{destination.name}</p>
                </div>
              </div>

              {routeInfo && (
                <>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/40">
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs">Distance</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{routeInfo.distance}</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs">ETA</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">{routeInfo.duration}</p>
                    </div>
                  </div>

                  <Button className="w-full" size="lg" onClick={openInGoogleMaps}>
                    <Navigation className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </Button>
                </>
              )}
            </div>
          </Card>

          {/* Emergency Contact */}
          <Card className="p-6 bg-card border-border/40">
            <h3 className="font-semibold mb-3 text-foreground">Emergency Contacts</h3>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="tel:112">
                  <Phone className="w-4 h-4 mr-2" />
                  Emergency: 112
                </a>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <a href="tel:102">
                  <Phone className="w-4 h-4 mr-2" />
                  Ambulance: 102
                </a>
              </Button>
            </div>
          </Card>

          {/* Directions Steps */}
          {routeInfo && routeInfo.steps.length > 0 && (
            <Card className="p-6 bg-card border-border/40">
              <h3 className="font-semibold mb-3 text-foreground">Turn-by-Turn Directions</h3>
              <div className="space-y-2">
                {routeInfo.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-medium text-primary">{index + 1}</span>
                    </div>
                    <p className="text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden border-border/40" style={{ height: 'calc(100vh - 140px)' }}>
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.google.com/maps/embed/v1/directions?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&mode=driving`}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Emergency;
