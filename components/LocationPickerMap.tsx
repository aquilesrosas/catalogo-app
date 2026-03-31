import React, { useRef, useCallback } from 'react';
import { StyleSheet, View, TextInput, Pressable, Text, ActivityIndicator, Alert, Platform, ScrollView } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

interface LocationPickerProps {
  initialLocation?: { lat: number; lng: number };
  onLocationSelect: (lat: number, lng: number) => void;
  onAddressResolved?: (address: string) => void;
  showCrosshair?: boolean;
}

interface PhotonSuggestion {
  lat?: number;
  lng?: number;
  label: string;
  place_id?: string;
}

const GOOGLE_API_KEY = "AIzaSyBNcC-FItywab7GpiQMDlq0KzsHXvnyTe8";

const LocationPickerMap: React.FC<LocationPickerProps> = ({
  initialLocation,
  onLocationSelect,
  onAddressResolved,
  showCrosshair = true
}) => {
  const webviewRef = useRef<WebView>(null);
  const lastSearchTime = useRef(0);
  const lastSearchedNumber = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchText, setSearchText] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [resolvedAddress, setResolvedAddress] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<PhotonSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  // Build a readable label from Photon feature properties
  const buildLabel = (props: any, userNumber?: string | null): string => {
    const street = props.street || props.name || '';
    const houseNum = props.housenumber || userNumber || '';
    const district = props.district || props.locality || '';
    const city = props.city || props.town || props.village || '';
    const state = props.state || '';
    const postcode = props.postcode || '';

    const streetPart = houseNum ? `${street} ${houseNum}` : street;
    const parts = [streetPart, district, city, state, postcode].filter(Boolean);
    return parts.join(', ');
  };

  // Fetch autocomplete suggestions from Photon API
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=es&components=country:ar&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data && data.predictions && data.predictions.length > 0) {
        const items: PhotonSuggestion[] = data.predictions.map((p: any) => {
          return {
            label: p.description,
            place_id: p.place_id,
          };
        });
        setSuggestions(items);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (e) {
      console.error('Google Places autocomplete error:', e);
    }
  }, [initialLocation]);

  // Debounced text change handler
  const handleTextChange = (text: string) => {
    setSearchText(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 400);
  };

  // When user selects a suggestion
  const selectSuggestion = async (suggestion: PhotonSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSearchText('');
    setSearching(true);

    try {
      if (suggestion.place_id) {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${suggestion.place_id}&fields=geometry&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.result && data.result.geometry) {
           const lat = data.result.geometry.location.lat;
           const lng = data.result.geometry.location.lng;
           webviewRef.current?.injectJavaScript(`
             isProgrammaticMove = true;
             map.setView([${lat}, ${lng}], 17, { animate: false });
             true;
           `);
           onLocationSelect(lat, lng);
        }
      }
      setResolvedAddress(suggestion.label);
      onAddressResolved?.(suggestion.label);
      lastSearchTime.current = Date.now();
    } catch (e) {
      console.error("Geocoding fetch error:", e);
    } finally {
      setSearching(false);
    }
  };

  const handleLocateMe = async () => {
    setLocating(true);
    setShowSuggestions(false);
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

  // Fallback: manual search button (uses Photon too)
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    setShowSuggestions(false);
    try {
      const query = searchText.trim();
      const matchNumber = query.match(/\b\d+\b/);
      const userNumber = matchNumber ? matchNumber[0] : null;
      lastSearchedNumber.current = userNumber;

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&language=es&components=country:ar&key=${GOOGLE_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data && data.predictions && data.predictions.length > 0) {
        const placeId = data.predictions[0].place_id;
        const finalAddress = data.predictions[0].description;
        
        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_API_KEY}`;
        const detailsRes = await fetch(detailsUrl);
        const detailsData = await detailsRes.json();
        
        if (detailsData && detailsData.result && detailsData.result.geometry) {
           const newLat = detailsData.result.geometry.location.lat;
           const newLng = detailsData.result.geometry.location.lng;
           
           webviewRef.current?.injectJavaScript(`
             isProgrammaticMove = true;
             map.setView([${newLat}, ${newLng}], 17, { animate: false });
             true;
           `);
           onLocationSelect(newLat, newLng);
           setResolvedAddress(finalAddress);
           onAddressResolved?.(finalAddress);
           lastSearchTime.current = Date.now();
        }
      } else {

        // Fallback: try Nominatim
        const headers = { 'Accept-Language': 'es', 'User-Agent': 'MinisuperCatalogo/1.0 (akilerosas@gmail.com)' };
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Salta, Argentina')}&limit=1&addressdetails=1`;
        const nomRes = await fetch(nomUrl, { headers });
        const nomResults = await nomRes.json();
        if (nomResults && nomResults.length > 0) {
          const { lat, lon, address } = nomResults[0];
          const newLat = parseFloat(lat);
          const newLng = parseFloat(lon);
          
          let finalAddress = query; // Use exactly what they searched since we found it

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
          if (Platform.OS === 'web') {
            window.alert('No se encontró la dirección. Probá con más detalle.');
          } else {
            Alert.alert('No encontrado', 'No se encontró la dirección. Probá con más detalle.');
          }
        }
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
          onChangeText={handleTextChange}
          placeholder="Buscá tu dirección..."
          placeholderTextColor="#999"
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
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

      {/* Autocomplete suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 180 }}>
            {suggestions.map((s, i) => (
              <Pressable
                key={`${s.lat}-${s.lng}-${i}`}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  pressed && { backgroundColor: '#E8F5E9' },
                  i < suggestions.length - 1 && styles.suggestionBorder,
                ]}
                onPress={() => selectSuggestion(s)}
              >
                <Text style={styles.suggestionPin}>📍</Text>
                <Text style={styles.suggestionText} numberOfLines={2}>{s.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Resolved address display */}
      {resolvedAddress && !showSuggestions ? (
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
                if (Date.now() - lastSearchTime.current < 10000) return;
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
    marginBottom: 0,
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
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 10,
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { zIndex: 100 } : { elevation: 5 }),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  suggestionPin: {
    fontSize: 14,
    marginRight: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  addressBar: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 4,
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
