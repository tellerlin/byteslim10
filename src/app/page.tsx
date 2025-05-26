import Link from 'next/link'

export default function Home() {
  const tools = [
    {
      title: 'Image Compression',
      description: 'Compress your images while maintaining quality',
      href: '/image',
      icon: '🖼️'
    },
    {
      title: 'Audio Compression',
      description: 'Reduce audio file size without losing quality',
      href: '/audio',
      icon: '🎵'
    },
    {
      title: 'PPT Compression',
      description: 'Compress PowerPoint presentations efficiently',
      href: '/ppt',
      icon: '📊'
    }
  ]

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold text-center mb-12">
        ByteSlim File Compression Tools
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="text-4xl mb-4">{tool.icon}</div>
            <h2 className="text-xl font-semibold mb-2">{tool.title}</h2>
            <p className="text-gray-600">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
