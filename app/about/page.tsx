import Link from "next/link";

export default function AboutPage(): JSX.Element {
    return (
        <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header / Hero */}
                <header className="text-center mb-12">
                    <div className="inline-flex items-center justify-center p-4 bg-white/60 rounded-full shadow-sm mb-6">
                        <svg className="w-10 h-10 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a8 8 0 0 0-8 8v12h16V10a8 8 0 0 0-8-8Z" />
                            <path d="M12 14v8" />
                        </svg>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">
                        🌲 About Forest Watch
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        AI-powered deforestation detection for Sumatra — analyze satellite or aerial images to identify active forest clearing and support conservation efforts.
                    </p>
                </header>

                {/* Project Overview */}
                <main className="space-y-8">
                    <section className="bg-white rounded-lg shadow-sm p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-3">Project overview</h2>
                        <p className="text-gray-700 leading-relaxed">
                            Forest Watch analyzes aerial and satellite images (Google Earth Pro) to automatically detect active deforestation —
                            areas showing clearing, exposed soil, or logging patterns. The system focuses on timely, actionable detections to help researchers and policy makers.
                        </p>
                    </section>

                    {/* Dataset & Stats */}
                    <section className="grid gap-6 md:grid-cols-2">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dataset collection</h3>
                            <p className="text-gray-700 mb-4">
                                Imagery captured at various altitudes and locations across Sumatra. Samples were filtered for clouds, blur, and duplicates before annotation.
                            </p>
                            <ul className="list-disc list-inside text-gray-700 space-y-1">
                                <li>Source: Google Earth Pro</li>
                                <li>Top-down, north-oriented images</li>
                                <li>Camera altitude: 1000m – 2000m (close-ups: 100–300m)</li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Dataset statistics</h3>

                            <dl className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-blue-50 rounded">
                                    <dt className="text-sm text-gray-600">Collected</dt>
                                    <dd className="text-2xl font-bold text-blue-600">132</dd>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 rounded">
                                    <dt className="text-sm text-gray-600">After filtering</dt>
                                    <dd className="text-2xl font-bold text-yellow-600">122</dd>
                                </div>
                                <div className="text-center p-3 bg-green-50 rounded">
                                    <dt className="text-sm text-gray-600">Annotated</dt>
                                    <dd className="text-2xl font-bold text-green-600">61</dd>
                                </div>
                            </dl>

                            <p className="text-gray-600 text-sm mt-4">
                                Filtering removed images with heavy cloud cover, blur, inconsistent lighting, or duplicates.
                            </p>
                        </div>
                    </section>

                    {/* Detection Criteria */}
                    <section className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detection criteria</h3>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex gap-3">
                                <div className="text-2xl">🟤</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Color indicators</h4>
                                    <p className="text-gray-700">Brown, gray, or yellowish areas lacking green vegetation.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="text-2xl">📐</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Geometric patterns</h4>
                                    <p className="text-gray-700">Open clearings with rectilinear or repetitive clearing shapes.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="text-2xl">🪵</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Logging evidence</h4>
                                    <p className="text-gray-700">Visible logging roads, stacked logs, or equipment traces.</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="text-2xl">🌲</div>
                                <div>
                                    <h4 className="font-medium text-gray-900">Forest context</h4>
                                    <p className="text-gray-700">Located inside or adjacent to forest cover (not plantations or paddy fields).</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-sm">
                            Note: Palm oil plantations, mines, rice paddies, and residential areas are excluded from deforestation classification.
                        </div>
                    </section>

                    {/* Tech stack */}
                    <section className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Technology stack</h3>

                        <div className="grid md:grid-cols-2 gap-6 text-gray-700">
                            <div>
                                <h4 className="font-medium text-gray-900">Data collection</h4>
                                <ul className="mt-2 space-y-1">
                                    <li>• Google Earth Pro</li>
                                    <li>• Manual annotation & filtering</li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-medium text-gray-900">AI & training</h4>
                                <ul className="mt-2 space-y-1">
                                    <li>• Roboflow (training & deployment)</li>
                                    <li>• Object detection workflow</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Goal / CTA */}
                    <section className="rounded-lg p-6 text-white bg-gradient-to-r from-green-600 to-green-700">
                        <div className="max-w-3xl mx-auto text-center">
                            <h3 className="text-2xl font-bold">Project goal</h3>
                            <p className="text-green-50 mt-2">
                                Provide an accessible automated tool to monitor deforestation in Sumatra, enabling timely intervention and conservation.
                            </p>
                        </div>
                    </section>

                    {/* Footer */}
                    <footer className="mt-6 text-gray-600">
                        <div className="max-w-2xl mx-auto text-center">
                            <p className="mb-1">Developed as part of a forest conservation research initiative</p>
                            <p className="text-sm">Data collected from Sumatra, Indonesia • 2024–2025</p>
                        </div>
                    </footer>
                </main>
            </div>
        </div>
    );
}