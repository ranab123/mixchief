import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }
    
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
    }
    
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`
    );
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch video data' }, { status: response.status });
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }
    
    const videoDetails = data.items[0];
    const snippet = videoDetails.snippet;
    const contentDetails = videoDetails.contentDetails;
    
    // Convert ISO 8601 duration to human-readable format
    const duration = contentDetails.duration.replace('PT', '')
      .replace('H', 'h ')
      .replace('M', 'm ')
      .replace('S', 's');
    
    // Prefer the highest quality thumbnail available (maxres -> standard -> high -> medium -> default)
    const thumbs = snippet.thumbnails as Record<string, { url: string }>;
    const bestThumbUrl =
      thumbs.maxres?.url ||
      thumbs.standard?.url ||
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url;

    return NextResponse.json({
      title: snippet.title,
      channelTitle: snippet.channelTitle,
      duration: duration,
      thumbnailUrl: bestThumbUrl,
      videoId: videoId
    });
    
  } catch (error) {
    console.error('Error fetching YouTube data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
