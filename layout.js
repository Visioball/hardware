        class FaceLayoutPlanner {
            constructor(facePlacements) {
                this.facePlacements = facePlacements;
            }

            selectSmallestBalancedFaces(count, excludedIndices = [], minimumClearance = 0) {
                const candidates = this.facePlacements.map((placement, index) => ({ placement, index }))
                    .filter(candidate => !excludedIndices.includes(candidate.index) && candidate.placement.clearance >= minimumClearance)
                    .sort((first, second) => first.placement.area - second.placement.area);
                if (candidates.length < count && minimumClearance > 0) {
                    return this.selectSmallestBalancedFaces(count, excludedIndices, 0);
                }
                const selected = [];
                const smallestPool = candidates.slice(0, Math.min(candidates.length, Math.max(count, count * 2)));

                while (selected.length < count && smallestPool.length) {
                    const candidate = smallestPool.reduce((best, current) => {
                        const separation = selected.length
                            ? Math.max(...selected.map(index => current.placement.normal.dot(this.facePlacements[index].normal)))
                            : -1;
                        const balanceError = selected.concat(current.index).reduce((center, index) =>
                            center.add(this.facePlacements[index].normal), new THREE.Vector3()).length();
                        const score = current.placement.area / candidates[candidates.length - 1].placement.area +
                            Math.max(0, separation + 1) * 0.25 + balanceError * 0.02;
                        if (best === null || score < best.score) {
                            return { candidate: current, score };
                        }
                        return best;
                    }, null);
                    selected.push(candidate.candidate.index);
                    smallestPool.splice(smallestPool.indexOf(candidate.candidate), 1);
                }

                return selected;
            }

            selectLargestSpreadFaces(count, excludedIndices = [], referenceIndices = [], referenceWeight = 3, candidateWeight = 1) {
                const candidates = this.facePlacements.map((placement, index) => ({ placement, index }))
                    .filter(candidate => !excludedIndices.includes(candidate.index))
                    .sort((first, second) => second.placement.area - first.placement.area);
                const selected = [];
                const largestPool = candidates.slice(0, Math.min(candidates.length, Math.max(count, count * 2)));

                while (selected.length < count && largestPool.length) {
                    const candidate = largestPool.reduce((best, current) => {
                        const comparedFaces = [...referenceIndices, ...selected];
                        const separation = comparedFaces.length
                            ? Math.max(...comparedFaces.map(index => current.placement.normal.dot(this.facePlacements[index].normal)))
                            : -1;
                        const consideredFaces = [...referenceIndices, ...selected, current.index];
                        const weightedCenter = consideredFaces.reduce((center, index) => {
                            const weight = referenceIndices.includes(index) ? referenceWeight : candidateWeight;
                            return center.add(this.facePlacements[index].position.clone().multiplyScalar(weight));
                        }, new THREE.Vector3());
                        const totalWeight = referenceIndices.length * referenceWeight +
                            (selected.length + 1) * candidateWeight;
                        const massError = weightedCenter.length() / totalWeight / DEFAULT_SPHERE_RADIUS;
                        const sizePenalty = 1 - current.placement.area / candidates[0].placement.area;
                        const score = massError * 2 + sizePenalty * 0.5 + Math.max(0, separation + 1) * 0.25;
                        return best === null || score < best.score ? { candidate: current, score } : best;
                    }, null);
                    selected.push(candidate.candidate.index);
                    largestPool.splice(largestPool.indexOf(candidate.candidate), 1);
                }

                return selected;
            }

            selectBalancedFaces(count, excludedIndices = [], referenceIndices = [], referenceWeight = 1, candidateWeight = 1) {
                const selected = [...referenceIndices];
                const candidates = this.facePlacements.map((_, index) => index)
                    .filter(index => !excludedIndices.includes(index));

                while (selected.length < referenceIndices.length + count && candidates.length) {
                    const candidate = candidates.reduce((best, current) => {
                        const consideredFaces = [...selected, current];
                        const weightedCenter = consideredFaces.reduce((center, index) => {
                            const weight = referenceIndices.includes(index) ? referenceWeight : candidateWeight;
                            return center.add(this.facePlacements[index].normal.clone().multiplyScalar(weight));
                        }, new THREE.Vector3());
                        const totalWeight = referenceIndices.length * referenceWeight +
                            (consideredFaces.length - referenceIndices.length) * candidateWeight;
                        const balanceError = weightedCenter.length() / totalWeight;
                        const separation = selected.length
                            ? Math.max(...selected.map(index => this.facePlacements[current].normal.dot(this.facePlacements[index].normal)))
                            : -1;
                        const score = balanceError + Math.max(0, separation + 1) * 0.25;
                        if (best === null) {
                            return { index: current, score };
                        }
                        return score < best.score ? { index: current, score } : best;
                    }, null);
                    selected.push(candidate.index);
                    candidates.splice(candidates.indexOf(candidate.index), 1);
                }

                return selected.slice(referenceIndices.length);
            }

            selectOpposingFaces(count, minimumClearance = 0) {
                if (count % 2 !== 0) {
                    return null;
                }

                const pairs = [];
                for (let first = 0; first < this.facePlacements.length - 1; first += 1) {
                    for (let second = first + 1; second < this.facePlacements.length; second += 1) {
                        if (this.facePlacements[first].normal.dot(this.facePlacements[second].normal) < -0.98 &&
                            this.facePlacements[first].clearance >= minimumClearance &&
                            this.facePlacements[second].clearance >= minimumClearance) {
                            pairs.push([first, second]);
                        }
                    }
                }

                const selectedPairs = [];
                const remainingPairs = [...pairs];
                while (selectedPairs.length < count / 2 && remainingPairs.length) {
                    const pair = remainingPairs.reduce((best, current) => {
                        const selectedFaces = selectedPairs.flat();
                        const separation = selectedFaces.length
                            ? Math.max(...current.flatMap(currentFace => selectedFaces.map(selectedFace =>
                                this.facePlacements[currentFace].normal.dot(this.facePlacements[selectedFace].normal))))
                            : -1;
                        const bestSeparation = best === null
                            ? Infinity
                            : Math.max(...best.flatMap(currentFace => selectedFaces.map(selectedFace =>
                                this.facePlacements[currentFace].normal.dot(this.facePlacements[selectedFace].normal))));
                        return separation < bestSeparation ? current : best;
                    }, null);
                    selectedPairs.push(pair);
                    remainingPairs.splice(remainingPairs.indexOf(pair), 1);
                }

                return selectedPairs.length === count / 2 ? selectedPairs.flat() : null;
            }

            selectSpreadFaces(count, excludedIndices = [], referenceIndices = []) {
                const selected = [...referenceIndices];
                const candidates = this.facePlacements.map((_, index) => index)
                    .filter(index => !excludedIndices.includes(index));

                while (selected.length < referenceIndices.length + count && candidates.length) {
                    const candidate = candidates.reduce((best, current) => {
                        const separation = selected.length
                            ? Math.max(...selected.map(index => this.facePlacements[current].normal.dot(this.facePlacements[index].normal)))
                            : -1;
                        const bestSeparation = best === null
                            ? Infinity
                            : Math.max(...selected.map(index => this.facePlacements[best].normal.dot(this.facePlacements[index].normal)));
                        return separation < bestSeparation ? current : best;
                    }, null);
                    selected.push(candidate);
                    candidates.splice(candidates.indexOf(candidate), 1);
                }

                return selected.slice(referenceIndices.length);
            }
        }
        function estimateSpeakerHalfAngle(frequency) {
            const bands = [[500, 75], [2000, 75], [5000, 60], [10000, 45], [20000, 35]];
            const clampedFrequency = Math.min(20000, Math.max(500, frequency));
            for (let index = 1; index < bands.length; index += 1) {
                const [upperFrequency, upperAngle] = bands[index];
                const [lowerFrequency, lowerAngle] = bands[index - 1];
                if (clampedFrequency <= upperFrequency) {
                    const fraction = (Math.log10(clampedFrequency) - Math.log10(lowerFrequency)) /
                        (Math.log10(upperFrequency) - Math.log10(lowerFrequency));
                    return lowerAngle + (upperAngle - lowerAngle) * fraction;
                }
            }
            return bands[bands.length - 1][1];
        }

        function buildLayout(shapeKey, speakerCount, radiatorCount, renderLayout = true, minimizeDiameter = false) {
            const definition = shapeCatalog.get(shapeKey);
            const createGeometry = radius => {
                const vertices = definition.createVertices(radius);
                const facePlacements = definition.faces.map(face => {
                    const position = new THREE.Vector3();
                    face.forEach(vertexIndex => position.add(vertices[vertexIndex]));
                    position.divideScalar(face.length);
                    const normal = position.clone().normalize();
                    let area = 0;
                    for (let index = 1; index < face.length - 1; index += 1) {
                        const firstEdge = vertices[face[index]].clone().sub(vertices[face[0]]);
                        const secondEdge = vertices[face[index + 1]].clone().sub(vertices[face[0]]);
                        area += firstEdge.cross(secondEdge).length() / 2;
                    }
                    const clearance = face.reduce((minimum, vertexIndex, index) => {
                        const start = vertices[vertexIndex];
                        const end = vertices[face[(index + 1) % face.length]];
                        const edge = end.clone().sub(start);
                        const distance = edge.clone().cross(position.clone().sub(start)).length() / edge.length();
                        return Math.min(minimum, distance);
                    }, Infinity);
                    return { position, normal, area, clearance, outward: normal.dot(position.clone().normalize()) > 0.999 };
                });
                return { vertices, facePlacements };
            };

            const availableFaces = definition.faces.length;
            const safeSpeakerCount = Math.min(speakerCount, availableFaces);
            const safeRadiatorCount = Math.min(radiatorCount, availableFaces - safeSpeakerCount);
            const selectFaces = geometry => {
                const planner = new FaceLayoutPlanner(geometry.facePlacements);
                const speakerFaces = safeSpeakerCount === 6
                    ? (planner.selectOpposingFaces(6, SPEAKER_RADIUS) || planner.selectSmallestBalancedFaces(safeSpeakerCount, [], SPEAKER_RADIUS))
                    : planner.selectSmallestBalancedFaces(safeSpeakerCount, [], SPEAKER_RADIUS);
                const radiatorFaces = planner.selectLargestSpreadFaces(safeRadiatorCount, speakerFaces, speakerFaces);
                return { speakerFaces, radiatorFaces };
            };

            const requestedDiameter = minimizeDiameter
                ? DEFAULT_SPHERE_RADIUS * 2
                : Math.max(40, Number(sphereDiameterInput.value) || DEFAULT_SPHERE_RADIUS * 2);
            const requestedRadius = requestedDiameter / 2;
            let radius = requestedRadius;
            let geometry = createGeometry(radius);
            let selectedFaces = selectFaces(geometry);
            const componentFaces = [...selectedFaces.speakerFaces, ...selectedFaces.radiatorFaces];
            const smallestComponentClearance = componentFaces.length
                ? Math.min(...componentFaces.map(index => geometry.facePlacements[index].clearance))
                : 0;
            const faceAreas = geometry.facePlacements.map(placement => placement.area);
            const facesAreUniform = Math.max(...faceAreas) > 0 &&
                (Math.max(...faceAreas) - Math.min(...faceAreas)) / Math.max(...faceAreas) < 0.001;
            const minimumComponentRadius = SPEAKER_RADIUS;
            if (smallestComponentClearance > 0) {
                const minimumSafeRadius = requestedRadius * (minimumComponentRadius / smallestComponentClearance) * 1.02;
                radius = minimizeDiameter ? minimumSafeRadius : Math.max(requestedRadius, minimumSafeRadius);
                geometry = createGeometry(radius);
            }

            if (renderLayout && (minimizeDiameter || radius > requestedRadius)) {
                sphereDiameterInput.value = Math.ceil(radius * 2);
            }

            const { vertices, facePlacements } = geometry;
            const { speakerFaces, radiatorFaces } = selectedFaces;
            const weightedCenter = speakerFaces.reduce((center, index) =>
                center.add(facePlacements[index].position.clone().multiplyScalar(3)), new THREE.Vector3())
                .add(radiatorFaces.reduce((center, index) => center.add(facePlacements[index].position), new THREE.Vector3()));
            const totalMass = speakerFaces.length * 3 + radiatorFaces.length;
            const massOffset = totalMass ? weightedCenter.length() / totalMass : 0;
            const orientationOk = [...speakerFaces, ...radiatorFaces].every(index => facePlacements[index].outward);
            const speakerDirectivity = getMinimumAngularSeparation(speakerFaces, facePlacements);
            const radiatorDirectivity = getMinimumAngularSeparation(radiatorFaces, facePlacements);
            const result = {
                definition,
                availableFaces,
                vertices,
                facePlacements,
                speakerFaces,
                radiatorFaces,
                radius,
                safeSpeakerCount,
                safeRadiatorCount,
                massOffset,
                orientationOk,
                speakerDirectivity,
                radiatorDirectivity,
                feasible: safeSpeakerCount === speakerCount && safeRadiatorCount === radiatorCount
            };

            const directivityFrequency = Math.min(20000, Math.max(500, Number(directivityFrequencyInput.value) || 1000));
            directivityFrequencyInput.value = directivityFrequency;
            const coverageHalfAngle = estimateSpeakerHalfAngle(directivityFrequency);
            const prCoverageHalfAngle = 80;
            const soundRange = Math.min(1000, Math.max(40, Number(soundRangeInput.value) || 150));
            soundRangeInput.value = soundRange;
            if (renderLayout) {
                new LayoutRenderer(masterSphereGroup).render(definition, vertices, facePlacements, speakerFaces, radiatorFaces, radius, coverageHalfAngle, prCoverageHalfAngle, soundRange);
                suggestionText.textContent = `${definition.name}: ${safeSpeakerCount} speakers, ${safeRadiatorCount} radiators on ${availableFaces} faces.`;
                layoutStatusText.textContent = `Diameter: ${(radius * 2).toFixed(0)} mm | Orientation: ${orientationOk ? 'outward' : 'check faces'} | weighted mass offset: ${massOffset.toFixed(3)} mm | speaker spacing: ${speakerDirectivity.toFixed(1)}° | ${directivityFrequency} Hz: ±${coverageHalfAngle.toFixed(0)}° | range: ${soundRange} mm | PR field: ±${prCoverageHalfAngle.toFixed(0)}°`;
            }
            return result;
        }

        function getMinimumAngularSeparation(faceIndices, facePlacements) {
            if (faceIndices.length < 2) {
                return Math.PI;
            }
            let minimumAngle = Math.PI;
            for (let first = 0; first < faceIndices.length - 1; first += 1) {
                for (let second = first + 1; second < faceIndices.length; second += 1) {
                    const dot = THREE.MathUtils.clamp(
                        facePlacements[faceIndices[first]].normal.dot(facePlacements[faceIndices[second]].normal),
                        -1,
                        1
                    );
                    minimumAngle = Math.min(minimumAngle, Math.acos(dot));
                }
            }
            return minimumAngle;
        }

