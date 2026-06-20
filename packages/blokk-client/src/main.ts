import { initGPU } from './gpu'
import { CUBE_VERTICES, CUBE_VERTEX_COUNT, CUBE_STRIDE } from './cube'
import { perspective, lookAt, multiply } from './math'
import { GameNetwork } from './network'
import shaderSource from './shader.wgsl?raw'

async function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  canvas.width = window.innerWidth * devicePixelRatio
  canvas.height = window.innerHeight * devicePixelRatio

  const { device, context, format } = await initGPU(canvas)

  // Shader module
  const shaderModule = device.createShaderModule({ code: shaderSource })

  // Vertex buffer
  const vertexBuffer = device.createBuffer({
    size: CUBE_VERTICES.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(vertexBuffer, 0, CUBE_VERTICES)

  // Uniform buffer (MVP matrix)
  const uniformBuffer = device.createBuffer({
    size: 64, // mat4x4f = 16 floats = 64 bytes
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  // Bind group layout + bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' },
    }],
  })

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer },
    }],
  })

  // Pipeline
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs',
      buffers: [{
        arrayStride: CUBE_STRIDE,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  })

  // Depth texture
  let depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth * devicePixelRatio
    canvas.height = window.innerHeight * devicePixelRatio
    depthTexture.destroy()
    depthTexture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
  })

  // Network
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:9000'
  const net = new GameNetwork(`${wsUrl}?room=default`, (data) => {
    // TODO: handle incoming messages (other players' positions, block updates)
    console.log('received', new Uint8Array(data))
  })

  // Render loop
  let angle = 0

  function frame() {
    angle += 0.01

    const aspect = canvas.width / canvas.height
    const proj = perspective(Math.PI / 4, aspect, 0.1, 100)
    const eye = [Math.cos(angle) * 4, 3, Math.sin(angle) * 4]
    const view = lookAt(eye, [0.5, 0.5, 0.5], [0, 1, 0])
    const mvp = multiply(proj, view)

    device.queue.writeBuffer(uniformBuffer, 0, mvp.buffer)

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.setVertexBuffer(0, vertexBuffer)
    pass.draw(CUBE_VERTEX_COUNT)
    pass.end()

    device.queue.submit([encoder.finish()])
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}

main()
