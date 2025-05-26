import Link from 'next/link'

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="text-xl font-bold text-gray-800">
            ByteSlim
          </Link>
          
          <div className="flex space-x-4">
            <Link href="/image" className="text-gray-600 hover:text-gray-900">
              Image
            </Link>
            <Link href="/audio" className="text-gray-600 hover:text-gray-900">
              Audio
            </Link>
            <Link href="/ppt" className="text-gray-600 hover:text-gray-900">
              PPT
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
} 