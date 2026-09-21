        class LayoutRenderer {
            constructor(group) {
                this.group = group;
            }

            clear() {
                while (this.group.children.length) {
                    const child = this.group.children.pop();
                    child.geometry?.dispose();
                    child.material?.dispose();
                }
            }

            render(definition, vertices, facePlacements, speakerFaces, radiatorFaces, radius, coverageHalfAngle, prCoverageHalfAngle, soundRange) {
                this.clear();
                const baseSphereGeo = new THREE.SphereGeometry(radius, 32, 32);
                const sphereMesh = new THREE.Mesh(baseSphereGeo, new THREE.MeshBasicMaterial({ color: 0x68717a, wireframe: true, transparent: true, opacity: 0.48 }));
                sphereMesh.userData.layer = 'shell';
                this.group.add(sphereMesh);
                const edges = definition.getEdges();
                const ledLineWidth = 1.8;
                const wireframeInset = ledLineWidth * 0.5;
                const ledProjectionInset = wireframeInset * 0.25;
                const wireframeRadius = radius - wireframeInset;
                this.addWireframeEdges(vertices, edges, wireframeRadius, 0x9bdfff, 0.95);
                this.addProjectedLedEdges(vertices, edges, radius - ledProjectionInset, ledColorInputs.map(input => input.value), 0.95, ledLineWidth);
                this.addDiameterIndicator(radius);
                const faceAreas = facePlacements.map(placement => placement.area);
                const largestArea = Math.max(...faceAreas);
                const smallestArea = Math.min(...faceAreas);
                const facesAreUniform = largestArea > 0 && (largestArea - smallestArea) / largestArea < 0.001;
                const componentInset = wireframeInset + ledLineWidth * 0.05;
                speakerFaces.forEach(faceIndex => this.addComponent(facePlacements[faceIndex], SPEAKER_RADIUS, 0x00ff66, 'speakers', componentInset));
                this.addDirectivityCones(facePlacements, speakerFaces, coverageHalfAngle, componentInset, soundRange);
                const radiatorDiameters = [];
                radiatorFaces.forEach(faceIndex => {
                    const radiatorRadius = facesAreUniform
                        ? SPEAKER_RADIUS
                        : Math.max(SPEAKER_RADIUS, facePlacements[faceIndex].clearance * RADIATOR_FILL_RATIO);
                    radiatorDiameters.push(radiatorRadius * 2);
                    this.addComponent(facePlacements[faceIndex], radiatorRadius, 0xff3366, 'radiators', componentInset);
                });
                this.addPassiveRadiatorFields(facePlacements, radiatorFaces, prCoverageHalfAngle, componentInset, soundRange);
                if (!radiatorDiameters.length) {
                    radiatorSizeLabel.textContent = 'Passive radiators (none)';
                } else {
                    const minimumDiameter = Math.round(Math.min(...radiatorDiameters));
                    const maximumDiameter = Math.round(Math.max(...radiatorDiameters));
                    radiatorSizeLabel.textContent = minimumDiameter === maximumDiameter
                        ? `Passive radiators (${minimumDiameter} mm)`
                        : `Passive radiators (${minimumDiameter}-${maximumDiameter} mm)`;
                }
            }

            addWireframeEdges(points, edges, targetRadius, color, opacity) {
                const projectedPoints = points.map(point => point.clone().normalize().multiplyScalar(targetRadius));
                const edgePoints = [];
                edges.forEach(([start, end]) => edgePoints.push(projectedPoints[start], projectedPoints[end]));
                const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
                const edgeMat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
                const wireframe = new THREE.LineSegments(edgeGeo, edgeMat);
                wireframe.userData.layer = 'wireframe';
                this.group.add(wireframe);
            }

            addProjectedLedEdges(points, edges, projectionRadius, colors, opacity, lineWidth) {
                edges.forEach(([start, end]) => {
                    const startDirection = points[start].clone().normalize();
                    const endDirection = points[end].clone().normalize();
                    const shellRadius = projectionRadius;
                    const segmentCount = 18;
                    for (let segment = 0; segment < segmentCount; segment += 1) {
                        const startPoint = startDirection.clone().lerp(endDirection, segment / segmentCount).normalize().multiplyScalar(shellRadius);
                        const endPoint = startDirection.clone().lerp(endDirection, (segment + 1) / segmentCount).normalize().multiplyScalar(shellRadius);
                        const direction = endPoint.clone().sub(startPoint);
                        const ribPosition = segment / (segmentCount - 1);
                        const ledPositions = [0.2, 0.5, 0.8];
                        const controlPositions = [0, ...ledPositions, 1];
                        const controlColors = [new THREE.Color(0x000000), ...colors.map(color => new THREE.Color(color)), new THREE.Color(0x000000)];
                        let controlIndex = controlPositions.length - 2;
                        for (let index = 0; index < controlPositions.length - 1; index += 1) {
                            if (ribPosition <= controlPositions[index + 1]) {
                                controlIndex = index;
                                break;
                            }
                        }
                        const controlSpan = controlPositions[controlIndex + 1] - controlPositions[controlIndex];
                        const blend = (ribPosition - controlPositions[controlIndex]) / controlSpan;
                        const edgeColor = controlColors[controlIndex].clone().lerp(controlColors[controlIndex + 1], blend);
                        const edgeGeo = new THREE.CylinderGeometry(lineWidth / 2, lineWidth / 2, direction.length(), 8);
                        const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor, transparent: opacity < 1, opacity });
                        const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
                        edgeMesh.userData.layer = 'led';
                        edgeMesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
                        edgeMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
                        this.group.add(edgeMesh);
                    }
                });
            }

            addDirectivityCones(facePlacements, speakerFaces, coverageHalfAngle, componentInset, coneLength) {
                const coneRadius = coneLength * Math.tan(THREE.MathUtils.degToRad(coverageHalfAngle));
                const material = new THREE.MeshBasicMaterial({ color: 0x00e6ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
                speakerFaces.forEach(faceIndex => {
                    const placement = facePlacements[faceIndex];
                    const geometry = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
                    const cone = new THREE.Mesh(geometry, material);
                    cone.userData.layer = 'directivity';
                    const origin = placement.position.clone().add(placement.normal.clone().multiplyScalar(-componentInset));
                    cone.position.copy(origin).add(placement.normal.clone().multiplyScalar(coneLength / 2));
                    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), placement.normal.clone().negate());
                    this.group.add(cone);
                });
            }

            addPassiveRadiatorFields(facePlacements, radiatorFaces, halfAngle, componentInset, fieldLength) {
                const fieldRadius = fieldLength * Math.tan(THREE.MathUtils.degToRad(halfAngle));
                const material = new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide });
                radiatorFaces.forEach(faceIndex => {
                    const placement = facePlacements[faceIndex];
                    const geometry = new THREE.ConeGeometry(fieldRadius, fieldLength, 32, 1, true);
                    const field = new THREE.Mesh(geometry, material);
                    field.userData.layer = 'pr-directivity';
                    const origin = placement.position.clone().add(placement.normal.clone().multiplyScalar(-componentInset));
                    field.position.copy(origin).add(placement.normal.clone().multiplyScalar(fieldLength / 2));
                    field.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), placement.normal.clone().negate());
                    this.group.add(field);
                });
            }

            addDiameterIndicator(radius) {
                const dimensionY = 0;
                const tickSize = radius * 0.08;
                const points = [
                    new THREE.Vector3(-radius, dimensionY, 0), new THREE.Vector3(radius, dimensionY, 0),
                    new THREE.Vector3(-radius, dimensionY - tickSize, 0), new THREE.Vector3(-radius, dimensionY + tickSize, 0),
                    new THREE.Vector3(radius, dimensionY - tickSize, 0), new THREE.Vector3(radius, dimensionY + tickSize, 0)
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
                const dimensionLine = new THREE.LineSegments(geometry, material);
                dimensionLine.userData.layer = 'dimension';
                this.group.add(dimensionLine);

                const labelCanvas = document.createElement('canvas');
                labelCanvas.width = 512;
                labelCanvas.height = 96;
                const context = labelCanvas.getContext('2d');
                context.fillStyle = '#ffffff';
                context.font = 'bold 44px sans-serif';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(`Ø${Math.round(radius * 2)} mm`, 256, 48);
                const labelTexture = new THREE.CanvasTexture(labelCanvas);
                const labelMaterial = new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: false });
                const label = new THREE.Sprite(labelMaterial);
                label.userData.layer = 'dimension';
                label.position.set(0, dimensionY, 1);
                label.scale.set(radius * 1.6, radius * 0.3, 1);
                this.group.add(label);
            }

            addComponent(placement, radius, color, layer, inset) {
                const geometry = new THREE.CircleGeometry(radius, 32);
                const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.4 }));
                mesh.userData.layer = layer;
                mesh.position.copy(placement.position).add(placement.normal.clone().multiplyScalar(-inset));
                mesh.lookAt(placement.position.clone().add(placement.normal));
                this.group.add(mesh);
            }
        }
