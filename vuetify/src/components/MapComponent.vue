<template>
  <v-layout class="rounded rounded-md">
    <v-app-bar title="Road Mapping">
      <v-btn @click="switchToDrawPolygonMode" color="primary">Draw Polygon</v-btn>
      <v-btn @click="switchToDrawLineMode" color="info">Draw Line</v-btn>
      <v-btn @click="switchToNavigateMode" color="secondary">Navigate Map</v-btn>
      <v-btn @click="getPolygonData" color="success">Fetch Data within Polygon</v-btn>
      <v-btn @click="removePolygons" color="error">Remove Polygon</v-btn>
      <v-btn @click="removeLine" color="error">Remove Line</v-btn>
      <v-spacer></v-spacer>
      <v-btn @click="logout" color="error">Logout</v-btn> 
    </v-app-bar>

    <v-main>
      <div ref="mapContainer" class="map-container" style="min-height: 500px;"></div>
      
      <v-navigation-drawer v-model="isDrawingLine" temporary right>
        <v-form v-if="isDrawingLine">
          <v-text-field v-model="lineDetails.yolhizlimiti" label="Speed Limit" type="number"></v-text-field>
          <v-text-field v-model="lineDetails.yoltipi" label="Road Type" type="number"></v-text-field>
          <v-text-field v-model="lineDetails.yoladi" label="Road Name"></v-text-field>
          <v-text-field v-model="lineDetails.yolbolge" label="Road Region"></v-text-field>
          <v-text-field v-model="lineDetails.yoltamadres" label="Road Address"></v-text-field>
          <v-btn @click="saveLine" color="success">Save Line Data</v-btn>
        </v-form>
      </v-navigation-drawer>

      <v-navigation-drawer v-model="isEditing" max-width="500px">
        <v-card>
          <v-card-title>Edit Road</v-card-title>
          <v-card-text>
            <v-form>
              <v-text-field v-model="editDetails.yolhizlimiti" label="Speed Limit" type="number"></v-text-field>
              <v-text-field v-model="editDetails.yoltipi" label="Road Type" type="number"></v-text-field>
              <v-text-field v-model="editDetails.yoladi" label="Road Name"></v-text-field>
              <v-text-field v-model="editDetails.yolbolge" label="Road Region"></v-text-field>
              <v-text-field v-model="editDetails.yoltamadres" label="Road Address"></v-text-field>

              <!-- Hidden fields for remaining unchanged data -->
              <input type="hidden" v-model="editDetails.uzunluk"/>
              <input type="hidden" v-model="editDetails.merkezlat"/>
              <input type="hidden" v-model="editDetails.merkezlong"/>
              <input type="hidden" v-model="editDetails.coordinates"/>
            </v-form>
          </v-card-text>
          <v-card-actions>
            <v-btn @click="updateRoad" color="success">Save</v-btn>
            <v-btn @click="deleteRoad" color="error">Delete</v-btn>
            <v-btn @click="cancelEditing" color="secondary">Cancel</v-btn>
            <v-btn @click="isEditing=false" color="secondary">Cancel</v-btn>
          </v-card-actions>
        </v-card>
      </v-navigation-drawer>

      
      <div v-if="loading" class="loading-container">
        <div class="loading-overlay">
          <v-progress-circular indeterminate color="primary" size="64"></v-progress-circular>
        </div>
      </div>
    </v-main>
  </v-layout>
</template>

<script setup>
import { onMounted, ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import * as turf from '@turf/turf';

const router = useRouter();

const mapContainer = ref();
const draw = ref(null);
let map = null;
const isDrawingLine = ref(false);
let drawedLine = null;
const lineDetails = ref({
  yolhizlimiti: '',
  yoltipi: '',
  yoladi: '',
  yolbolge: '',
  yoltamadres: '',
});
const isEditing = ref(false);
const editDetails = ref({});
const selectedRoadId = ref(null);
const drawer = ref(false);
const loading = ref(false);
const routesData = reactive({
  type: 'FeatureCollection',
  features: [],
});

const editingRoadId = ref(null);
const editingRoadColor = '#FF6347'; 
const defaultRoadColor = '#888'; 

// Define max allowed area in square kilometers
const maxAllowedArea = 40000;

const checkAuth = () => {
  const accessToken = localStorage.getItem('accessToken');
  if (!accessToken) {
    router.push('/login');
  }
};

const logout = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  router.push('/login');
};

onMounted(() => {
  checkAuth(); 
  setTimeout(() => {
    createMap();
  }, 300);
});

const clearPolygon = () => {
  draw.value.deleteAll(); 
  console.log('All drawn polygons cleared');
};

function createMap() {
  map = new maplibregl.Map({
    container: mapContainer.value,
    style: 'https://api.maptiler.com/maps/streets/style.json?key=get_your_own_OpIi9ZULNHzrESv6T2vL',
    center: [27.1509391, 38.3663641], // Initial center 
    zoom: 15 // Initial zoom level
  });

  draw.value = new MapboxDraw({
    displayControlsDefault: true,
    controls: {
      polygon: true,
      line_string: true, 
      trash: true
    }
  });

  map.addControl(draw.value);

  map.on('load', () => {
    if (!map.getSource('routes')) {
      map.addSource('routes', {
        type: 'geojson',
        data: routesData,
      });

      map.addLayer({
        id: 'routesLayer',
        type: 'line',
        source: 'routes',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': defaultRoadColor,
          'line-width': 4,
        },
      });
    }

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['routesLayer']
      });
      if (features.length) {
        const road = features[0];
        console.log('Clicked road feature:', road); 
        selectedRoadId.value = road.properties.id || road.id; 
        console.log('Selected Road ID:', selectedRoadId.value); 
        loadRoadDetails(selectedRoadId.value);
        // Highlight the selected road
        editingRoadId.value = selectedRoadId.value;  // Store the edited road ID
        updateRoadLayerStyle(); // Update road style to edited color
      }
    });

    map.on('mouseenter', 'routesLayer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'routesLayer', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('draw.create', (e) => {
      if (e.features[0].geometry.type === 'Polygon') {
        const polygon = e.features[0];  

        const area = turf.area(polygon);
        const areaInKm2 = area / 1e6;

        if (areaInKm2 > maxAllowedArea) {
          alert(`Polygon exceeds the maximum allowed size of ${maxAllowedArea} square kilometers!`);
          draw.value.delete(e.features[0].id); 
          return;
        }
      } else if (e.features[0].geometry.type === 'LineString' && draw.value.getMode() === 'draw_line_string') {
        drawedLine = e.features[0].geometry.coordinates;
        console.log('Line drawn:', drawedLine);
        isDrawingLine.value = true; 
      }
    });
  });
}


const updateRoadLayerStyle = () => {
  map.setPaintProperty('routesLayer', 'line-color', [
    'case',
    ['==', ['get', 'id'], editingRoadId.value], // Check if the road's ID equals the editing road ID
    editingRoadColor, // If true, use editing color
    defaultRoadColor // Otherwise, use the default color
  ]);
};

// Reset the layer style when editing is done or cancelled
const resetRoadLayerStyle = () => {
  editingRoadId.value = null; // Reset the editing road ID
  updateRoadLayerStyle(); // Reset to original road colors
};

const switchToDrawPolygonMode = () => {
  draw.value.changeMode('draw_polygon');
  isDrawingLine.value = false;
};

const switchToDrawLineMode = () => {
  draw.value.changeMode('draw_line_string');
};

const switchToNavigateMode = () => {
  draw.value.changeMode('simple_select');
  isDrawingLine.value = false;
  map.dragPan.enable();
  map.scrollZoom.enable();
};

const removePolygons = () => {
  const allFeatures = draw.value.getAll();
  allFeatures.features.forEach(feature => {
    if (feature.geometry.type === 'Polygon') {
      draw.value.delete(feature.id);
    }
  });
  console.log('All polygons removed');
};

const removeLine = () => {
    if (drawedLine) {
        draw.value.deleteAll(); 
        console.log('Line removed');
        drawedLine = null; 
        isDrawingLine.value = false; 
    } else {
        alert('No line to remove!');
    }
};

const loadRoadDetails = async (roadId) => {
  loading.value = true;
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/datayol/${roadId}/`);
    if (response.ok) {
      const data = await response.json();

      editDetails.value = {
        yolhizlimiti: data.properties.yolhizlimiti,
        yoltipi: data.properties.yoltipi,
        yoladi: data.properties.yoladi,
        yolbolge: data.properties.yolbolge,
        yoltamadres: data.properties.yoltamadres,
        uzunluk: data.properties.uzunluk,
        merkezlat: data.properties.merkezlat,
        merkezlong: data.properties.merkezlong,
        coordinates: data.geometry.coordinates,
      };

      isEditing.value = true;
    } else {
      console.error('Failed to load road details');
      alert('Failed to load road details');
    }
  } catch (error) {
    console.error('Error loading road details:', error);
  } finally {
    loading.value = false;
  }
};

const updateRoad = async () => {
  loading.value = true;
  try {
    const payload = {
      yolhizlimiti: editDetails.value.yolhizlimiti,
      yoltipi: editDetails.value.yoltipi,
      yoladi: editDetails.value.yoladi,
      yolbolge: editDetails.value.yolbolge,
      yoltamadres: editDetails.value.yoltamadres,
      uzunluk: editDetails.value.uzunluk,
      merkezlat: editDetails.value.merkezlat,
      merkezlong: editDetails.value.merkezlong,
      coordinates: editDetails.value.coordinates,
    };
    const response = await fetch(`http://127.0.0.1:8000/api/datayol/${selectedRoadId.value}/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      console.log('Road updated successfully');
      isEditing.value = false;
      map.getSource('routes').setData(routesData);
    } else {
      const errorData = await response.json();
      console.error('Failed to update road:', errorData);
      alert('Failed to update road');
    }
  } catch (error) {
    console.error('Error updating road:', error);
  } finally {
    loading.value = false;
  }
  resetRoadLayerStyle();
};

const deleteRoad = async () => {
  loading.value = true;
  try {
    const response = await fetch(`http://127.0.0.1:8000/api/datayol/${selectedRoadId.value}/`, {
      method: 'DELETE'
    });
    if (response.ok) {
      console.log('Road deleted');
      isEditing.value = false;
      map.getSource('routes').setData(routesData);
    } else {
      alert('Failed to delete road');
    }
  } catch (error) {
    console.error('Error deleting road:', error);
  } finally {
    loading.value = false;
  }
  resetRoadLayerStyle();
};

// Call this function when editing is canceled also
const cancelEditing = () => {
  resetRoadLayerStyle(); // Reset road layer style if editing is canceled
  isEditing.value = false; // Close the editing modal
};

const getPolygonData = async () => {
  const drawnFeatures = draw.value.getAll();
  
  if (!drawnFeatures.features.length) {
    return alert('Draw a polygon first!');
  }

  const polygon = drawnFeatures.features;
  console.log('--->', polygon);
  loading.value = true;
  try {
    const resp = await fetch('http://127.0.0.1:8000/api/datayol/filter/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ polygon })
    });

    const response = await resp.json();
    console.log('Filtered data:', response);
  
    let data = response.data;
    if (data.features.length > 0) {
      routesData.features = data.features;
      map.getSource('routes').setData(routesData);
    } else {
      alert('No features found within the polygon.');
    }
  } catch (error) {
    console.error('Error fetching filtered data:', error);
  } finally {
    loading.value = false;
  }
};

const saveLine = async () => {
  const drawnFeatures = draw.value.getAll();
  
  if (!drawnFeatures.features.length) {
    return alert('Draw a line first!');
  }

  const line = drawnFeatures.features[0].geometry.coordinates;
  loading.value = true;
  try {
    const response = await fetch('http://127.0.0.1:8000/api/datayol/create/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        coordinates: drawedLine,
        yolhizlimiti: lineDetails.value.yolhizlimiti,
        yoltipi: lineDetails.value.yoltipi,
        yoladi: lineDetails.value.yoladi,
        yolbolge: lineDetails.value.yolbolge,
        yoltamadres: lineDetails.value.yoltamadres,
      })
    });

    const result = await response.json();
    console.log('Line saved:', result);
    routesData.features.push(result.data)
    map.getSource('routes').setData(routesData);

    draw.value.deleteAll();
    lineDetails.value = { yolhizlimiti: '', yoltipi: '', yoladi: '', yolbolge: '', yoltamadres: '' };
  } catch (error) {
    console.error('Error saving line data:', error);
  } finally {
    loading.value = false;
  }
};
</script>

<style>
@import "@/assets/mapbox-gl-draw.css"; 

.map-container {
  width: 100%;
  height: 800px;
}
.maplibregl-control-container {
  display: none;
}
.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.8);
  z-index: 1000;
}
.loading-overlay {
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
