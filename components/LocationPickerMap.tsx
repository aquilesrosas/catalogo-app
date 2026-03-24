import React, { useRef } from 'react';
import { StyleSheet, View, TextInput, Pressable, Text, ActivityIndicator, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressResolved?: (address: string) => void;
  showCrosshair?: boolean;
}

const LocationPickerMap: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  onAddressResolved,
  showCrosshair = true
}) => {
  const webviewRef = useRef<WebView>(null);
  const lastSearchTime = useRef(0);
  const lastSearchedNumber = useRef<string | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [resolvedAddress, setResolvedAddress] = React.useState('');

  const handleLocateMe = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Permití el acceso a la ubicación para usar esta función.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      // Move the map without setting isProgrammaticMove so it triggers reverse geocoding
      webviewRef.current?.injectJavaScript(`
        map.setView([${lat}, ${lng}], 17, { animate: false });
        true;
      `);
      onLocationSelect(lat, lng);
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'No pudimos obtener tu ubicación actual.');
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const query = searchText.trim();
      const headers = { 
        'Accept-Language': 'es',
        'User-Agent': 'MinisuperCatalogo/1.0 (akilerosas@gmail.com)'
      };

      // Bias search toward user's area
      const viewbox = initialLocation
        ? `&viewbox=${initialLocation.lng - 0.2},${initialLocation.lat + 0.2},${initialLocation.lng + 0.2},${initialLocation.lat - 0.2}&bounded=1`
        : '';

      // Try free text search first (usually better for street numbers)
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Salta, Argentina')}&limit=5&addressdetails=1${viewbox}`;
      
      const res = await fetch(url, { headers });
      let results = await res.json();
      
      // Fallback to structured search if needed
      if (!results || results.length === 0) {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&street=${encodeURIComponent(query)}&city=Salta&state=Salta&country=Argentina&limit=5&addressdetails=1${viewbox}`;
        const fallbackRes = await fetch(fallbackUrl, { headers });
        results = await fallbackRes.json();
      }

      // If still no results, strip numbers and search for just the street
      if (!results || results.length === 0) {
        const queryWithoutNumbers = query.replace(/[0-9]/g, '').trim();
        if (queryWithoutNumbers) {
            const streetFallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryWithoutNumbers + ', Salta, Argentina')}&limit=5&addressdetails=1${viewbox}`;
            const streetFallbackRes = await fetch(streetFallbackUrl, { headers });
            results = await streetFallbackRes.json();
        }
      }
      
      if (results && results.length > 0) {
        const { lat, lon, display_name, address } = results[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);
        
        // Extract number from user's search text to preserve it
        const matchNumber = searchText.match(/\b\d+\b/);
        const userNumber = matchNumber ? matchNumber[0] : null;
        lastSearchedNumber.current = userNumber;
        
        // Build a clean, short address: "Street Number, Neighbourhood, City"
        let finalAddress = '';
        if (address) {
            const road = address.road || address.pedestrian || address.street || '';
            const houseNum = address.house_number || userNumber || '';
            const suburb = address.suburb || address.neighbourhood || '';
            const city = address.city || address.town || address.village || '';
            const state = address.state || '';
            const postcode = address.postcode || '';
            
            const streetPart = houseNum ? `${road} ${houseNum}` : road;
            const parts = [streetPart, suburb, city, state, postcode].filter(Boolean);
            finalAddress = parts.join(', ');
        }
        
        // Fallback to display_name if we couldn't build a better one
        if (!finalAddress) {
            finalAddress = display_name;
        }
        
        // If user typed a number and it's STILL missing, force it in
        if (userNumber && !finalAddress.includes(userNumber)) {
            const parts = finalAddress.split(', ');
            parts[0] = `${parts[0]} ${userNumber}`;
            finalAddress = parts.join(', ');
        }
        
        // Move the webview map
        webviewRef.current?.injectJavaScript(`
                    isProgrammaticMove = true;
                    map.setView([${newLat}, ${newLng}], 17, { animate: false });
                    true;
                `);
        onLocationSelect(newLat, newLng);
        setResolvedAddress(finalAddress);
        onAddressResolved?.(finalAddress);
        lastSearchTime.current = Date.now();
      } else {
        Alert.alert('No encontrado', 'No se encontró la dirección. Probá con más detalle.');
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
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location', lat: center.lat, lng: center.lng }));
              return;
            }
            
            const center = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'location', lat: center.lat, lng: center.lng }));
            
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
                  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'address', address: cleanAddress || data.display_name }));
                }
              })
              .catch(function() {});
            }, 800);
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
        <Pressable style={[styles.searchBtn, { backgroundColor: '#2196F3' }]} onPress={handleLocateMe} disabled={locating}>
          {locating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>📍</Text>
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
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.map}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'location' && data.lat && data.lng) {
                onLocationSelect(data.lat, data.lng);
              }
              if (data.type === 'address' && data.address) {
                // Don't let reverse geocode override a recent search result (10s cooldown)
                if (Date.now() - lastSearchTime.current < 10000) return;
                // Re-inject the user's house number if the reverse geocode lost it
                let addr = data.address;
                if (lastSearchedNumber.current && !addr.includes(lastSearchedNumber.current)) {
                    const parts = addr.split(', ');
                    parts[0] = `${parts[0]} ${lastSearchedNumber.current}`;
                    addr = parts.join(', ');
                }
                setResolvedAddress(addr);
                onAddressResolved?.(addr);
              }
            } catch (e) { }
          }}
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
  map: { flex: 1 },
  helpText: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default LocationPickerMap;
