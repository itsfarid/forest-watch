export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🌲 About Forest Watch
          </h1>
          <p className="text-xl text-gray-600">
            AI-Powered Deforestation Detection System for Sumatra
          </p>
        </div>

        {/* Project Overview */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Overview</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Forest Watch is an AI-powered system designed to automatically detect deforestation 
            in Sumatra using satellite imagery. The system analyzes aerial photographs from 
            Google Earth Pro to identify active deforestation areas, helping monitor forest 
            conservation efforts.
          </p>
          <p className="text-gray-700 leading-relaxed">
            This project focuses on <strong>active deforestation</strong> detection - areas where 
            forest clearing is visibly ongoing, characterized by brown, gray, or yellowish coloring, 
            lack of green vegetation, and visible logging activity.
          </p>
        </section>

        {/* Dataset Collection */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dataset Collection Process</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-2">Data Source</h3>
              <p className="text-gray-700">
                Satellite imagery captured from <strong>Google Earth Pro</strong> across 
                multiple regions in Sumatra, Indonesia.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-2">Target Regions</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Tapanuli Selatan: 25 samples</li>
                <li>Aceh Tamiang: 57 samples</li>
                <li>Agam: 28 samples</li>
                <li>Close-up imagery: 15 samples (100-300m altitude)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-2">Technical Standards</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                <li>Camera altitude: 1000m - 2000m</li>
                <li>Top-down view (perpendicular to ground)</li>
                <li>North-oriented imagery</li>
                <li>Maximum resolution JPEG format</li>
                <li>High terrain quality settings</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Data Statistics */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dataset Statistics</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="text-4xl font-bold text-blue-600 mb-2">132</div>
              <div className="text-gray-700">Initial Images Collected</div>
            </div>
            
            <div className="text-center p-6 bg-yellow-50 rounded-lg">
              <div className="text-4xl font-bold text-yellow-600 mb-2">122</div>
              <div className="text-gray-700">Images After Filtering</div>
            </div>
            
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-4xl font-bold text-green-600 mb-2">61</div>
              <div className="text-gray-700">Annotated Datasets</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Filtering Criteria</h3>
            <p className="text-gray-700 text-sm">
              Images removed due to: cloud coverage, blur, inconsistent lighting/lines, 
              and duplicate samples to ensure dataset quality.
            </p>
          </div>
        </section>

        {/* Detection Criteria */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Deforestation Detection Criteria</h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">🟤</span>
              <div>
                <h3 className="font-semibold text-gray-900">Color Indicators</h3>
                <p className="text-gray-700">Brown, gray, or yellowish areas lacking green vegetation</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-2xl mr-3">📐</span>
              <div>
                <h3 className="font-semibold text-gray-900">Geometric Patterns</h3>
                <p className="text-gray-700">Open areas with geometric clearing patterns</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-2xl mr-3">🪵</span>
              <div>
                <h3 className="font-semibold text-gray-900">Logging Evidence</h3>
                <p className="text-gray-700">Visible logging activity, cut wood, and cleared pathways</p>
              </div>
            </div>

            <div className="flex items-start">
              <span className="text-2xl mr-3">🌲</span>
              <div>
                <h3 className="font-semibold text-gray-900">Forest Context</h3>
                <p className="text-gray-700">Located within or surrounded by forested areas</p>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <strong>Note:</strong> Palm oil plantations, mining areas, rice paddies, and residential zones 
              are excluded from deforestation classification in this project, focusing specifically on 
              active forest clearing.
            </p>
          </div>
        </section>

        {/* Technology Stack */}
        <section className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Technology Stack</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Data Collection</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Google Earth Pro</li>
                <li>• Manual annotation and filtering</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">AI & Training</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Roboflow (model training & deployment)</li>
                <li>• Object detection workflow</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Web Application</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Next.js 14 (App Router)</li>
                <li>• React Server Components</li>
                <li>• Tailwind CSS</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Deployment</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Vercel (hosting & CI/CD)</li>
                <li>• Roboflow Serverless API</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Project Goal */}
        <section className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-md p-8 text-white">
          <h2 className="text-2xl font-bold mb-4">Project Goal</h2>
          <p className="leading-relaxed text-green-50">
            To provide an accessible, automated tool for monitoring deforestation in Sumatra&apos;s forests, 
            enabling researchers, conservationists, and policymakers to quickly assess forest health 
            and track changes over time. By leveraging AI and satellite imagery, we aim to support 
            timely intervention and forest conservation efforts.
          </p>
        </section>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p>Developed as part of forest conservation research initiative</p>
          <p className="text-sm mt-2">Data collected from Sumatra, Indonesia • 2024-2025</p>
        </div>

      </div>
    </div>
  );
}