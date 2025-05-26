export default function Footer() {
  return (
    <footer className="bg-white border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-gray-600">
          <p>© {new Date().getFullYear()} ByteSlim. All rights reserved.</p>
          <p className="mt-2 text-sm">
            Professional file compression tools for your needs
          </p>
        </div>
      </div>
    </footer>
  )
} 