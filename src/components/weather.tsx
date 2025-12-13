'use client';

import { useState, useEffect } from 'react';
import { Droplets, Wind, ChevronDown } from 'lucide-react';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface WeatherProps {
  city: string;
  unit: 'celsius' | 'fahrenheit';
}

interface ForecastPeriod {
  probabilityOfPrecipitation: any;
  name: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  startTime: string;
  windSpeed: string;
}

export function Weather({ city, unit }: WeatherProps) {
  const [useCelsius, setUseCelsius] = useState(unit === 'celsius');
  const [showFullForecast, setShowForecast] = useState(false);
  const [forecastDays, setForecastDays] = useState(2);
  const [forecast, setForecast] = useState<ForecastPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      try {
        setLoading(true);
        const getLatLong = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`
        );
        const getLatLongData = await getLatLong.json();
        
        if (!getLatLongData.length) {
          throw new Error('City not found');
        }
        
        const lat = getLatLongData[0].lat;
        const long = getLatLongData[0].lon;
        
        const pointResponse = await fetch(`https://api.weather.gov/points/${lat},${long}`);
        if (!pointResponse.ok) throw new Error('Failed to fetch weather point');
        
        const pointData = await pointResponse.json();
        const forecastResponse = await fetch(pointData.properties.forecast);
        if (!forecastResponse.ok) throw new Error('Failed to fetch forecast');
        
        const forecastData = await forecastResponse.json();
        setForecast(forecastData.properties.periods);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch weather');
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [city]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleClick = () => {
    setShowForecast(true);
    setForecastDays(8);
  };

  const handleConvert = () => {
    setUseCelsius(!useCelsius);
  };

  const convertToCelsius = (temp: number) => {
    return Math.round((temp - 32) * 5 / 9);
  };

  if (loading) {
    return (
      <div className="min-w-full mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg p-8 text-white text-center">
        Loading weather data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-full mx-auto bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg p-8 text-white text-center">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="min-w-full mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg overflow-hidden">
      <h2 className="text-4xl font-bold text-white text-center pt-8">{city}</h2>
      <div className="flex items-center space-x-2 text-white justify-center mt-3">
        <Label className={`text-sm ${!useCelsius ? 'font-bold' : ''}`}>°F</Label>
        <Switch id="temp-switch" checked={useCelsius} onCheckedChange={handleConvert} />
        <Label className={`text-sm ${useCelsius ? 'font-bold' : ''}`}>°C</Label>
      </div>
      {forecast.map(
        (day, index) =>
          index % 2 === 0 &&
          index < forecastDays && (
            <div key={index} className="px-6 py-8">
              <div className="flex items-center justify-between gap-10">
                <div>
                  <p className="text-lg font-semibold text-white mt-1">
                    {formatDate(day.startTime)}
                  </p>
                  <p className="text-blue-100 mt-1">{day.shortForecast}</p>
                </div>
                <div className="text-6xl font-bold text-white">
                  {useCelsius ? convertToCelsius(day.temperature) : day.temperature}°
                  {useCelsius ? 'C' : 'F'}
                </div>
              </div>
              <div className="mt-6 flex justify-between text-blue-100">
                <div className="flex items-center">
                  <Droplets size={18} className="mr-1" />
                  <span>
                    Precipitation:{' '}
                    {day.probabilityOfPrecipitation?.value ?? 0}%
                  </span>
                </div>
                <div className="flex items-center">
                  <Wind size={18} className="mr-1" />
                  <span>Wind: {day.windSpeed}</span>
                </div>
              </div>
              {!showFullForecast && (
                <div className="flex flex-row items-center justify-center pt-10 text-white">
                  <button className="text-sm font-semibold" onClick={handleClick}>
                    Show Complete Forecast
                  </button>
                  <ChevronDown size={20} />
                </div>
              )}
            </div>
          )
      )}
    </div>
  );
}