        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x121212);

        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
        camera.position.set(0, 0, 250);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // Add ambient and directional lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 100, 100);
        scene.add(dirLight);

        // --- 2. DEFINE SYSTEM SCALE AND SUPPORTED SOLIDS ---
        const DEFAULT_SPHERE_RADIUS = 50;
        const SPEAKER_RADIUS = 16;
        const RADIATOR_FILL_RATIO = 0.94;
        const speakerCountInput = document.getElementById('speaker-count');
        const radiatorCountInput = document.getElementById('radiator-count');
        const sphereDiameterInput = document.getElementById('sphere-diameter');
        const directivityFrequencyInput = document.getElementById('directivity-frequency');
        const soundRangeInput = document.getElementById('sound-range');
        const ledColorInputs = [
            document.getElementById('led-color-1'),
            document.getElementById('led-color-2'),
            document.getElementById('led-color-3')
        ];
        const shapeSelect = document.getElementById('shape-select');
        const suggestionText = document.getElementById('shape-suggestion');
        const layoutStatusText = document.getElementById('layout-status');
        const radiatorSizeLabel = document.getElementById('radiator-size-label');
        const masterSphereGroup = new THREE.Group();
        scene.add(masterSphereGroup);

        class LayoutController {
            constructor() {
                document.getElementById('app-explanation').addEventListener('wheel', event => event.stopPropagation(), { passive: true });
                document.getElementById('info-button').addEventListener('click', () => {
                    const button = document.getElementById('info-button');
                    const explanation = document.getElementById('app-explanation');
                    const isExpanded = button.getAttribute('aria-expanded') === 'true';
                    button.setAttribute('aria-expanded', String(!isExpanded));
                    button.title = isExpanded ? 'Show information' : 'Hide information';
                    explanation.hidden = isExpanded;
                    document.getElementById('ui-overlay').classList.toggle('compact', isExpanded);
                    updateProjectionViewport();
                });
                document.getElementById('settings-toggle').addEventListener('click', () => {
                    const settingsPanel = document.getElementById('ui-overlay');
                    const button = document.getElementById('settings-toggle');
                    const isVisible = !settingsPanel.classList.contains('settings-hidden');
                    settingsPanel.classList.toggle('settings-hidden', isVisible);
                    settingsPanel.setAttribute('aria-hidden', String(isVisible));
                    button.setAttribute('aria-expanded', String(!isVisible));
                    button.setAttribute('aria-label', isVisible ? 'Show settings' : 'Hide settings');
                    button.title = isVisible ? 'Show settings' : 'Hide settings';
                    button.innerHTML = isVisible ? '&#8594;' : '&#8592;';
                });
                document.getElementById('suggest-shape').addEventListener('click', () => {
                    shapeSelect.value = this.getSuggestedShapeKey();
                    this.applySettings(true);
                });
                document.getElementById('apply-layout').addEventListener('click', () => this.applySettings());
                document.getElementById('minimum-diameter').addEventListener('click', () => this.applySettings(true));
                shapeSelect.addEventListener('change', () => this.applySettings());
                speakerCountInput.addEventListener('input', () => this.updateSuggestion());
                radiatorCountInput.addEventListener('input', () => this.updateSuggestion());
                sphereDiameterInput.addEventListener('input', () => this.updateSuggestion());
                directivityFrequencyInput.addEventListener('change', () => this.applySettings());
                soundRangeInput.addEventListener('change', () => this.applySettings());
                ledColorInputs.forEach(input => input.addEventListener('input', () => this.applySettings()));
                document.querySelectorAll('.legend-toggle').forEach(button => {
                    button.addEventListener('click', () => this.toggleLayer(button));
                });
                this.updateSuggestion();
                this.applySettings();
            }

            toggleLayer(button) {
                const isVisible = button.getAttribute('aria-pressed') === 'true';
                const nextVisible = !isVisible;
                button.setAttribute('aria-pressed', String(nextVisible));
                this.applyLayerVisibility(button.dataset.layer, nextVisible);
            }

            applyLayerVisibility(layer, isVisible) {
                if (layer === 'led') {
                    document.getElementById('led-color-menu').hidden = !isVisible;
                }
                masterSphereGroup.traverse(object => {
                    if (object.userData.layer === layer) {
                        object.visible = isVisible;
                    }
                });
            }

            getSuggestedShapeKey() {
                const speakerCount = Math.max(1, Number(speakerCountInput.value) || 1);
                const radiatorCount = Math.max(0, Number(radiatorCountInput.value) || 0);
                const candidates = [...shapeCatalog.keys()]
                    .map(shapeKey => ({ shapeKey, result: buildLayout(shapeKey, speakerCount, radiatorCount, false, true) }))
                    .filter(candidate => candidate.result.feasible && candidate.result.orientationOk)
                    .map(candidate => {
                        const result = candidate.result;
                        const normalizedMassError = result.massOffset / result.radius;
                        const normalizedSpeakerDirectivity = result.speakerDirectivity / Math.PI;
                        const normalizedRadiatorDirectivity = result.radiatorDirectivity / Math.PI;
                        return {
                            ...candidate,
                            score: normalizedMassError * 6 +
                                (1 - normalizedSpeakerDirectivity) * 4 +
                                (1 - normalizedRadiatorDirectivity) * 1 +
                                result.availableFaces * 0.0001
                        };
                    })
                    .sort((first, second) => first.score - second.score);

                return candidates.length ? candidates[0].shapeKey : [...shapeCatalog.keys()].at(-1);
            }

            updateSuggestion() {
                const shapeKey = this.getSuggestedShapeKey();
                const shape = shapeCatalog.get(shapeKey);
                suggestionText.textContent = `${shape.name} selected by mass balance and directivity.`;
            }

            applySettings(minimizeDiameter = false) {
                const speakerCount = Math.max(1, Number(speakerCountInput.value) || 1);
                const radiatorCount = Math.max(0, Number(radiatorCountInput.value) || 0);
                const sphereDiameter = Math.min(1000, Math.max(40, Number(sphereDiameterInput.value) || DEFAULT_SPHERE_RADIUS * 2));
                speakerCountInput.value = speakerCount;
                radiatorCountInput.value = radiatorCount;
                sphereDiameterInput.value = sphereDiameter;
                const shapeKey = shapeSelect.value === 'auto' ? this.getSuggestedShapeKey() : shapeSelect.value;
                const shape = shapeCatalog.get(shapeKey);
                if (speakerCount + radiatorCount > shape.faces.length) {
                    suggestionText.textContent = `${shape.name} has ${shape.faces.length} faces; reduce components or choose a larger shape.`;
                }
                buildLayout(shapeKey, speakerCount, radiatorCount, true, minimizeDiameter);
                document.querySelectorAll('.legend-toggle').forEach(button => {
                    this.applyLayerVisibility(button.dataset.layer, button.getAttribute('aria-pressed') === 'true');
                });
            }
        }

        new LayoutController();

        function updateProjectionViewport() {
            const width = window.innerWidth;
            const height = container.clientHeight || window.innerHeight;
            camera.aspect = width / height;
            camera.lookAt(0, 0, 0);
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }

        updateProjectionViewport();

        // --- 6. USER INTERACTION INTERPOLATION CONTROL ---
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        
        // Target auto-rotations when user isn't interacting manually
        let rotationVelocityX = 0.003;
        let rotationVelocityY = 0.005;

        window.addEventListener('mousedown', (e) => { isDragging = true; });
        window.addEventListener('mousemove', (e) => {
            const deltaMove = {
                x: e.offsetX - previousMousePosition.x,
                y: e.offsetY - previousMousePosition.y
            };

            if (isDragging) {
                masterSphereGroup.rotation.y += deltaMove.x * 0.007;
                masterSphereGroup.rotation.x += deltaMove.y * 0.007;
                rotationVelocityX = 0; // Temporarily halt automated rotation
                rotationVelocityY = 0;
            }
            
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        });

        window.addEventListener('mouseup', (e) => { 
            isDragging = false; 
            // Slowly re-engage ambient spin after a manual drag release
            setTimeout(() => {
                if(!isDragging) { rotationVelocityX = 0.002; rotationVelocityY = 0.004; }
            }, 2000);
        });

        // Simple zoom handling via wheel event
        const MIN_CAMERA_DISTANCE = 40;
        const MAX_CAMERA_DISTANCE = 3000;
        window.addEventListener('wheel', (e) => {
            if (e.target.closest('.panel-column, .explanation-column')) {
                return;
            }
            camera.position.z += e.deltaY * 0.2;
            camera.position.z = Math.max(MIN_CAMERA_DISTANCE, Math.min(camera.position.z, MAX_CAMERA_DISTANCE));
            updateProjectionViewport();
        });

        // Handle browser layout scaling window updates safely
        window.addEventListener('resize', () => {
            updateProjectionViewport();
        });

        // --- 7. ANIMATION RENDER LOOP ---
        function animate() {
            requestAnimationFrame(animate);

            // Apply constant passive spin
            if (!isDragging) {
                masterSphereGroup.rotation.x += rotationVelocityX;
                masterSphereGroup.rotation.y += rotationVelocityY;
            }

            renderer.render(scene, camera);
        }
        
        animate();
