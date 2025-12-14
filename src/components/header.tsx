import * as React from 'react'
import Link from 'next/link'
import EnvCard from './cards/envcard'

export async function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 border-b shrink-0 bg-white">  
      <div className="flex items-center gap-8">
        <Link href="/" className="font-bold text-xl flex items-center gap-2 text-green-700 hover:text-green-800 transition-colors">
           🌲 Forest Watch
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            href="/" 
            className="text-gray-600 hover:text-green-700 transition-colors font-medium"
          >
            Home
          </Link>
          <Link 
            href="/about" 
            className="text-gray-600 hover:text-green-700 transition-colors font-medium"
          >
            About
          </Link>
        </nav>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Mobile Navigation */}
        <nav className="md:hidden flex items-center gap-4">
          <Link 
            href="/about" 
            className="text-sm text-gray-600 hover:text-green-700 transition-colors font-medium"
          >
            About
          </Link>
        </nav>
        
        <EnvCard />
      </div>
    </header>
  )
}