        class SolidDefinition {
            constructor(name, rawVertices, faces) {
                if (new.target === SolidDefinition) {
                    throw new Error('SolidDefinition is abstract. Use a concrete solid.');
                }
                this.name = name;
                this.rawVertices = rawVertices;
                this.faces = faces;
            }

            createVertices(radius) {
                return this.rawVertices.map(vertex =>
                    new THREE.Vector3(vertex[0], vertex[1], vertex[2]).normalize().multiplyScalar(radius));
            }

            getEdges() {
                return [...new Set(this.faces.flatMap(face => face.map((vertex, index) => {
                    const nextVertex = face[(index + 1) % face.length];
                    return [vertex, nextVertex].sort((a, b) => a - b).join('-');
                })))]
                    .map(edge => edge.split('-').map(Number));
            }
        }

        class ConvexSolidDefinition extends SolidDefinition {
            constructor(name, rawVertices) {
                super(name, rawVertices, ConvexSolidDefinition.buildFaces(rawVertices));
            }

            static buildFaces(vertices) {
                const faces = new Map();
                const epsilon = 1e-7;
                const subtract = (first, second) => first.map((value, index) => value - second[index]);
                const cross = (first, second) => [
                    first[1] * second[2] - first[2] * second[1],
                    first[2] * second[0] - first[0] * second[2],
                    first[0] * second[1] - first[1] * second[0]
                ];
                const dot = (first, second) => first.reduce((sum, value, index) => sum + value * second[index], 0);

                for (let first = 0; first < vertices.length - 2; first += 1) {
                    for (let second = first + 1; second < vertices.length - 1; second += 1) {
                        for (let third = second + 1; third < vertices.length; third += 1) {
                            const normal = cross(subtract(vertices[second], vertices[first]), subtract(vertices[third], vertices[first]));
                            const distances = vertices.map(vertex => dot(normal, subtract(vertex, vertices[first])));
                            if (distances.every(distance => distance >= -epsilon) || distances.every(distance => distance <= epsilon)) {
                                const face = distances.map((distance, index) => Math.abs(distance) < epsilon ? index : -1).filter(index => index >= 0);
                                const key = face.slice().sort((a, b) => a - b).join('-');
                                if (!faces.has(key)) {
                                    const center = face.reduce((sum, index) => sum.map((value, axis) => value + vertices[index][axis]), [0, 0, 0]).map(value => value / face.length);
                                    const axis = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
                                    const basisU = cross(normal, axis);
                                    const basisV = cross(normal, basisU);
                                    face.sort((left, right) => {
                                        const leftVector = subtract(vertices[left], center);
                                        const rightVector = subtract(vertices[right], center);
                                        return Math.atan2(dot(leftVector, basisV), dot(leftVector, basisU)) - Math.atan2(dot(rightVector, basisV), dot(rightVector, basisU));
                                    });
                                    faces.set(key, face);
                                }
                            }
                        }
                    }
                }
                return [...faces.values()];
            }
        }

        class Tetrahedron extends SolidDefinition {
            constructor() {
                super('Tetrahedron', [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]],
                    [[0, 1, 2], [0, 3, 1], [0, 2, 3], [1, 3, 2]]);
            }
        }

        class Cube extends SolidDefinition {
            constructor() {
                super('Cube', [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]],
                    [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]);
            }
        }

        class Octahedron extends SolidDefinition {
            constructor() {
                super('Octahedron', [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
                    [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 3], [1, 3, 4], [1, 4, 2]]);
            }
        }

        class Icosahedron extends SolidDefinition {
            constructor() {
                const goldenRatio = (1 + Math.sqrt(5)) / 2;
                super('Icosahedron', [[-1, goldenRatio, 0], [1, goldenRatio, 0], [-1, -goldenRatio, 0], [1, -goldenRatio, 0], [0, -1, goldenRatio], [0, 1, goldenRatio], [0, -1, -goldenRatio], [0, 1, -goldenRatio], [goldenRatio, 0, -1], [goldenRatio, 0, 1], [-goldenRatio, 0, -1], [-goldenRatio, 0, 1]],
                    [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]]);
            }
        }

        class Dodecahedron extends ConvexSolidDefinition {
            constructor() {
                const icosahedron = new Icosahedron();
                const vertices = icosahedron.faces.map(face => {
                    const center = face.reduce((sum, vertexIndex) => sum.map((value, axis) => value + icosahedron.rawVertices[vertexIndex][axis]), [0, 0, 0]);
                    const length = Math.hypot(...center);
                    return center.map(value => value / length);
                });
                super('Dodecahedron', vertices);
            }
        }

        class TruncatedHexahedron extends ConvexSolidDefinition {
            constructor() {
                const longCoordinate = 1 + Math.sqrt(2);
                const vertices = [];
                for (let longAxis = 0; longAxis < 3; longAxis += 1) {
                    for (const firstSign of [-1, 1]) {
                        for (const secondSign of [-1, 1]) {
                            for (const thirdSign of [-1, 1]) {
                                const point = [firstSign, secondSign, thirdSign];
                                point[longAxis] = point[longAxis] < 0 ? -longCoordinate : longCoordinate;
                                vertices.push(point);
                            }
                        }
                    }
                }
                super('Truncated Hexahedron', vertices);
            }
        }

        class TruncatedOctahedron extends ConvexSolidDefinition {
            constructor() {
                const vertices = [];
                for (const permutation of [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]) {
                    for (const firstSign of [-1, 1]) {
                        for (const secondSign of [-1, 1]) {
                            let signIndex = 0;
                            vertices.push(permutation.map(value => value === 0 ? 0 : value * (signIndex++ === 0 ? firstSign : secondSign)));
                        }
                    }
                }
                super('Truncated Octahedron', vertices);
            }
        }

        class Cuboctahedron extends ConvexSolidDefinition {
            constructor() {
                const vertices = [];
                for (let zeroAxis = 0; zeroAxis < 3; zeroAxis += 1) {
                    for (const firstSign of [-1, 1]) {
                        for (const secondSign of [-1, 1]) {
                            const point = [firstSign, secondSign, 0];
                            point.splice(zeroAxis, 0, point.pop());
                            vertices.push(point);
                        }
                    }
                }
                super('Cuboctahedron', vertices);
            }
        }

        const shapeCatalog = new Map([
            ['tetrahedron', new Tetrahedron()],
            ['cube', new Cube()],
            ['octahedron', new Octahedron()],
            ['icosahedron', new Icosahedron()],
            ['truncated-hexahedron', new TruncatedHexahedron()],
            ['truncated-octahedron', new TruncatedOctahedron()],
            ['cuboctahedron', new Cuboctahedron()],
            ['dodecahedron', new Dodecahedron()]
        ]);
