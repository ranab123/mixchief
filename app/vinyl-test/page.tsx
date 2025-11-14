"use client";

import VinylCover3D from "../components/VinylCover3D";

export default function VinylTestPage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-8">VinylCover3D - Step 4: Soft Contact Shadow</h1>
      
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <p className="text-gray-600 mb-4 text-center">
          3D Album Sleeve with Soft Contact Shadow (200x200px)
        </p>
        <VinylCover3D 
          src="/images/vinyl.png" 
          size={200} 
        />
        <p className="text-xs text-gray-500 mt-2 text-center">
          Notice the soft shadow underneath the sleeve
        </p>
      </div>
      
      <div className="mt-8 bg-white p-8 rounded-lg shadow-lg">
        <p className="text-gray-600 mb-4 text-center">
          Multiple Instances with Realistic Shadows
        </p>
        <div className="flex gap-6">
          <VinylCover3D 
            src="https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg" 
            size={250} 
          />
          <VinylCover3D 
            src="/images/vinyl.png" 
            size={250} 
          />
        </div>
      </div>
    </main>
  );
}

