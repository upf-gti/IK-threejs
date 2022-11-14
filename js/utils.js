const ShaderChunk = {

	Point: {
		vertexshader: `
			attribute float size;
			attribute vec3 color;
			varying vec3 vColor;
			void main() {
				vColor = color;
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_PointSize = size * ( 300.0 / -mvPosition.z );
				gl_Position = projectionMatrix * mvPosition;
			}
		`,

		fragmentshader: `
			uniform vec3 color;
			uniform sampler2D pointTexture;
			uniform float alphaTest;
			varying vec3 vColor;
			void main() {
				gl_FragColor = vec4(vColor, 1.0 );
				gl_FragColor = gl_FragColor * texture2D( pointTexture, gl_PointCoord );
				if ( gl_FragColor.a < alphaTest ) discard;
			}
		`
	}

};

export { ShaderChunk }