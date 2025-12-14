import * as React from 'react'
import Link from 'next/link'
import EnvCard from './cards/envcard'

export async function Header() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 border-b shrink-0 bg-white">  
      <div className="flex items-center">
        <Link href="/" className="font-bold text-xl flex items-center gap-2 text-green-700">
           🌲 Forest Watch
        </Link>
      </div>
      
      <div className="flex items-center">
        <EnvCard />
      </div>
    </header>
  )
}