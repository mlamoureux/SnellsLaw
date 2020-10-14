/**
 * Copyright 2018 - M. Lamoureux 
 *
 */
function WaveEngine(gpgpUtility_, xResolution_, yResolution_, xLength_, yLength_, dt_)
{
  "use strict";

  var dt;
  var dtHandle;
  var fbos;
  var gl;						/** WebGLRenderingContext */
  var gpgpUtility;
  var oldWaveFunctionHandle; 	/** The wave function at t - delta t */
  var pixels;
  var positionHandle;
  var potential;
  var potentialHandle;
  var program;
   var step;  // count mode 3, to identify which textures are the time source, which is the destination
  var textureCoordHandle;
  var textures;
  var waveFunctionHandle; /** The wave function at t */
  var xLength;
  var xLengthHandle;
  var xResolution;
  var xResolutionHandle;
  var yLength;
  var yLengthHandle;
  var yResolution;
  var yResolutionHandle;

  /**
   * Compile shaders and link them into a program, then retrieve references to the
   * attributes and uniforms. The standard vertex shader, which simply passes on the
   * physical and texture coordinates, is used.
   *
   * @returns {WebGLProgram} The created program object.
   * @see {https://www.khronos.org/registry/webgl/specs/1.0/#5.6|WebGLProgram}
   */
  this.createProgram = function (gl)
  {
    var fragmentShaderSource;
    var program;

    // Note that the preprocessor requires the newlines.
    fragmentShaderSource = "#ifdef GL_FRAGMENT_PRECISION_HIGH\n"
                         + "precision highp float;\n"
                         + "#else\n"
                         + "precision mediump float;\n"
                         + "#endif\n"
                         + ""
                         // The delta-t for each timestep.
                         + "uniform float dt;"
                         // The physical length of the grid in nm.
                         + "uniform float xLength;"
                         + "uniform float yLength;"
                         // At time t - delta t waveFunction.r is the real part waveFunction.g is the imaginary part.
                         + "uniform sampler2D oldWaveFunction;"
                         // The number of points along the x axis.
                         + "uniform int xResolution;"
                         // The number of points along the y axis.
                         + "uniform int yResolution;"
                         + ""
                         // At time t waveFunction.r is the real part waveFunction.g is the imaginary part.
                         + "uniform sampler2D waveFunction;"
                         // Discrete representation of the potential function.
                         + "uniform sampler2D potential;"
                         + ""
                         // Vector to mix the real and imaginary parts in the wave function update.
                         + "const vec2 mixing = vec2(-1.0, +1.0);"
                         + ""
                         + "varying vec2 vTextureCoord;"
                         + ""
                         + "void main()"
                         + "{"
                         + "  float dx;"
                         + "  float dy;"
                         + "  float h;"
                         + "  vec2  dss;"
                         + "  vec2  dtt;"
                         + "  vec4  value;"
                         + ""
                         + "  dx    = xLength/float(xResolution);"
                         + "  dy    = yLength/float(yResolution);"
                         + "  h     = dt*dt/(dx*dx);"
                         + "  dss    = vec2(1.0/float(xResolution), 0.0);"
                         + "  dtt    = vec2(0.0, 1.0/float(yResolution));"
                         + "  value = texture2D(waveFunction, vTextureCoord);"
                         + ""
                         + "  gl_FragColor.r = 2.0*value.r"
                         + "     - texture2D(oldWaveFunction,vTextureCoord).r"
                         + "     + (value.g)*dt*dt*( texture2D(waveFunction, vTextureCoord+dss).r"
                         + "     +     texture2D(waveFunction, vTextureCoord-dss).r" 
                         + "     -   2.0*value.r)/(dx*dx)"
                         + "     +  (value.g)*dt*dt*(texture2D(waveFunction, vTextureCoord+dtt).r"
                         + "     +     texture2D(waveFunction, vTextureCoord-dtt).r" 
                         + "     -   2.0*value.r )/(dy*dy);" 
                         + "  gl_FragColor.g = value.g;"  // carry over the speed variable
                         + "}";

    program               = gpgpUtility.createProgram(null, fragmentShaderSource);
    positionHandle        = gpgpUtility.getAttribLocation(program,  "position");
    gl.enableVertexAttribArray(positionHandle);
    textureCoordHandle    = gpgpUtility.getAttribLocation(program,  "textureCoord");
    gl.enableVertexAttribArray(textureCoordHandle);
    dtHandle              = gl.getUniformLocation(program, "dt");
    oldWaveFunctionHandle = gl.getUniformLocation(program, "oldWaveFunction");
    potentialHandle       = gl.getUniformLocation(program, "potential");
    waveFunctionHandle    = gl.getUniformLocation(program, "waveFunction");
    xResolutionHandle     = gl.getUniformLocation(program, "xResolution");
    yResolutionHandle     = gl.getUniformLocation(program, "yResolution");
    xLengthHandle         = gl.getUniformLocation(program, "xLength");
    yLengthHandle         = gl.getUniformLocation(program, "yLength");

    return program;
  };

  /**
   * Setup the initial values for textures. Two for values of the wave function,
   * and a third as a render target.
   */
  this.setInitialTextures = function(texture0, texture1, texture2)
  {
    textures[0] = texture0;
    fbos[0]     = gpgpUtility.attachFrameBuffer(texture0);
    textures[1] = texture1;
    fbos[1]     = gpgpUtility.attachFrameBuffer(texture1);
    textures[2] = texture2;
    fbos[2]     = gpgpUtility.attachFrameBuffer(texture2);
  }

  /**
   * Set the potential as a texture
   */
  this.setPotential = function(texture)
  {
    potential = texture;
  }

  /**
   * Runs the program to do the actual work. On exit the framebuffer &amp;
   * texture are populated with the next timestep of the wave function.
   * You can use gl.readPixels to retrieve texture values.
   */
  this.timestep = function()
  {
    var gl;

    gl = gpgpUtility.getComputeContext();

    gl.useProgram(program);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[(step+2)%3]);

    gpgpUtility.getStandardVertices();

    gl.vertexAttribPointer(positionHandle,     3, gl.FLOAT, gl.FALSE, 20, 0);
    gl.vertexAttribPointer(textureCoordHandle, 2, gl.FLOAT, gl.FALSE, 20, 12);

    gl.uniform1f(dtHandle,          dt);
    gl.uniform1i(xResolutionHandle, xResolution);
    gl.uniform1i(yResolutionHandle, yResolution);
    gl.uniform1f(xLengthHandle,     xLength);
    gl.uniform1f(yLengthHandle,     yLength);

   
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textures[step]);
    gl.uniform1i(oldWaveFunctionHandle, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, textures[(step+1)%3]);
    gl.uniform1i(waveFunctionHandle, 2);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step cycles though 0, 1, 2
    // Controld cycling over old, current and render target uses of textures
    step = (step+1)%3;
  };

  /**
   * Retrieve the most recently rendered to texture.
   *
   * @returns {WebGLTexture} The texture used as the rendering target in the most recent
   *                         timestep.
   */
  this.getRenderedTexture = function()
  {
      return textures[(step+1)%3];
  }

  /**
   * Retrieve the two frambuffers that wrap the textures for the old and current wavefunctions in the
   * next timestep. Render to these FBOs in the initialization step.
   *
   * @returns {WebGLFramebuffer[]} The framebuffers wrapping the source textures for the next timestep.
   */
  this.getSourceFramebuffers = function()
  {
    var value = [];
    value[0] = fbos[step];
    value[1] = fbos[(step+1)%3];
    return value;
  }

  /**
   * Retrieve the two textures for the old and current wave functions in the next timestep.
   * Fill these with initial values for the wave function.
   *
   * @returns {WebGLTexture[]} The source textures for the next timestep.
   */
  this.getSourceTextures     = function()
  {
    var value = [];
    value[0] = textures[step];
    return value;
  }

  /**
   * Invoke to clean up resources specific to this program. We leave the texture
   * and frame buffer intact as they are used in followon calculations.
   */
  this.done = function ()
  {
    gl.deleteProgram(program);
  };

  dt          = dt_;
  gpgpUtility = gpgpUtility_;
  gl          = gpgpUtility.getGLContext();
  program     = this.createProgram(gl);
  fbos        = new Array(3);  // I think this needs to be 3, not 2
  xLength      = xLength_;
  yLength      = yLength_;
  textures    = new Array(3);  // I think this needs to be 3, not 2
  step        = 0;
  xResolution = xResolution_;
  yResolution = yResolution_;
};