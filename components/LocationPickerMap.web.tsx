import React from 'react';
import { StyleSheet, View } from 'react-native';

interface LocationPickerProps {
    initialLocation?: { lat: number; lng: number };
    onLocationSelect: (lat: number, lng: number) => void;
    showCrosshair?: boolean;
}

const LocationPickerMapWeb: React.FC<LocationPickerProps> = ({
    initialLocation,
    onLocationSelect,
    showCrosshair = true
}) => {
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
          transform: translate(-50%, -50%);
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

        function initMap() {
          const startLat = ${initialLocation?.lat || -24.7821};
          const startLng = ${initialLocation?.lng || -65.4232};

          map = L.map('map', { zoomControl: false }).setView([startLat, startLng], 15);
          
          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
          }).addTo(map);

          map.on('moveend', function() {
            const center = map.getCenter();
            // Send back to RN web (iframe listener)
            window.parent.postMessage(JSON.stringify({ lat: center.lat, lng: center.lng }), '*');
          });
        }

        initMap();
      </script>
    </body>
    </html>
  `;

    return (
        <View style={styles.container}>
            <iframe
                srcDoc={htmlContent}
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={(e) => {
                    // Inject message listener for web iframe locally
                    const iframe = e.target as HTMLIFrameElement;
                    window.addEventListener('message', (event) => {
                        if (event.source === iframe.contentWindow) {
                            try {
                                const data = JSON.parse(event.data);
                                if (data.lat && data.lng) {
                                    onLocationSelect(data.lat, data.lng);
                                }
                            } catch (e) { }
                        }
                    });
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#eee', borderRadius: 12, overflow: 'hidden' },
    map: { flex: 1 },
});

export default LocationPickerMapWeb;
