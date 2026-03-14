import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, Text, ActivityIndicator } from 'react-native';

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressResolved?: (address: string) => void;
  showCrosshair?: boolean;
}

const LocationPickerMapWeb: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  onAddressResolved,
  showCrosshair = true
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [resolvedAddress, setResolvedAddress] = React.useState('');

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'location' && data.lat && data.lng) {
          onLocationSelect(data.lat, data.lng);
        }
        if (data.type === 'address' && data.address) {
          setResolvedAddress(data.address);
          onAddressResolved?.(data.address);
        }
      } catch (e) { }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLocationSelect, onAddressResolved]);

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      // Bias search toward user's current area
      const viewbox = initialLocation
        ? `&viewbox=${initialLocation.lng - 0.5},${initialLocation.lat + 0.5},${initialLocation.lng + 0.5},${initialLocation.lat - 0.5}&bounded=1`
        : '';
      // Use structured query: street param keeps the number attached
      const query = searchText.trim();
      const url = `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(query)}&city=Salta&state=Salta&country=Argentina&countrycodes=ar&limit=5&addressdetails=1${viewbox}`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      let results = await res.json();
      
      // If structured search didn't find results, fall back to free text
      if (!results || results.length === 0) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Salta, Argentina')}&countrycodes=ar&limit=5&addressdetails=1${viewbox}`;
        const fallbackRes = await fetch(fallbackUrl, { headers: { 'Accept-Language': 'es' } });
        results = await fallbackRes.json();
      }
      
      if (results && results.length > 0) {
        const { lat, lon, display_name, address } = results[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        
        // Extract number from user's search text to preserve it,
        // since OpenStreetMap often drops numbers it doesn't have exactly.
        const matchNumber = searchText.match(/\b\d+\b/);
        const userNumber = matchNumber ? matchNumber[0] : null;
        
        let finalAddress = display_name;
        
        // OpenStreetMap often removes the exact house number if it doesn't have it mapped.
        // If the user typed a number and it's missing from the OSM formatted address, 
        // we force it back into the first component (the street name).
        if (userNumber && !finalAddress.includes(userNumber)) {
            const parts = finalAddress.split(', ');
            parts[0] = `${parts[0]} ${userNumber}`;
            finalAddress = parts.join(', ');
        }
        
        // Move the iframe map
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ type: 'moveTo', lat: newLat, lng: newLng }),
          '*'
        );
        onLocationSelect(newLat, newLng);
        setResolvedAddress(finalAddress);
        onAddressResolved?.(finalAddress);
      } else {
        window.alert('No se encontró la dirección. Probá con más detalle.');
      }
    } catch (e) {
      console.error('Geocoding error:', e);
    } finally {
      setSearching(false);
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { width: 100%; height: 100vh; }
        .crosshair {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -100%);
          width: 40px;
          height: 40px;
          pointer-events: none;
          z-index: 1000;
          display: ${showCrosshair ? 'block' : 'none'};
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <img src="https://cdn-icons-png.flaticon.com/512/447/447031.png" class="crosshair" />
      
      <script>
        let map;
        let reverseTimer = null;
        let isProgrammaticMove = false;

        function initMap() {
          const startLat = ${initialLocation?.lat || -24.7821};
          const startLng = ${initialLocation?.lng || -65.4232};

          map = L.map('map', { zoomControl: false }).setView([startLat, startLng], 16);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
          }).addTo(map);

          map.on('moveend', function() {
            if (isProgrammaticMove) {
              isProgrammaticMove = false;
              const center = map.getCenter();
              window.parent.postMessage(JSON.stringify({ type: 'location', lat: center.lat, lng: center.lng }), '*');
              return;
            }
            
            const center = map.getCenter();
            window.parent.postMessage(JSON.stringify({ type: 'location', lat: center.lat, lng: center.lng }), '*');
            
            // Reverse geocode after a short delay
            clearTimeout(reverseTimer);
            reverseTimer = setTimeout(function() {
              fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + center.lat + '&lon=' + center.lng + '&zoom=18&addressdetails=1', {
                headers: { 'Accept-Language': 'es' }
              })
              .then(function(r) { return r.json(); })
              .then(function(data) {
                if (data && data.address) {
                  var addr = data.address;
                  var parts = [];
                  if (addr.road) parts.push(addr.road);
                  if (addr.house_number) parts.push(addr.house_number);
                  if (!addr.road && data.display_name) parts.push(data.display_name.split(',')[0]);
                  var city = addr.city || addr.town || addr.village || '';
                  var state = addr.state || '';
                  if (city) parts.push(city);
                  if (state && state !== city) parts.push(state);
                  var cleanAddress = parts.join(', ');
                  window.parent.postMessage(JSON.stringify({ type: 'address', address: cleanAddress || data.display_name }), '*');
                }
              })
              .catch(function() {});
            }, 800);
          });

          // Listen for parent commands
          window.addEventListener('message', function(e) {
            try {
              var cmd = JSON.parse(e.data);
              if (cmd.type === 'moveTo' && cmd.lat && cmd.lng) {
                isProgrammaticMove = true;
                map.setView([cmd.lat, cmd.lng], 17, { animate: false });
              }
            } catch(x) {}
          });
        }

        initMap();
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.wrapper}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscá tu dirección..."
          placeholderTextColor="#999"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>🔍</Text>
          )}
        </Pressable>
      </View>

      {/* Resolved address display */}
      {resolvedAddress ? (
        <View style={styles.addressBar}>
          <Text style={styles.addressText} numberOfLines={2}>📍 {resolvedAddress}</Text>
        </View>
      ) : null}

      {/* Map */}
      <View style={styles.container}>
        <iframe
          ref={iframeRef as any}
          srcDoc={htmlContent}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </View>

      <Text style={styles.helpText}>Ajustá moviendo el mapa para mayor precisión</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    borderRadius: 10,
    padding: 10,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  searchBtn: {
    backgroundColor: '#1B5E20',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: {
    fontSize: 18,
  },
  addressBar: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  addressText: {
    fontSize: 12,
    color: '#1B5E20',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
  },
  helpText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default LocationPickerMapWeb;
