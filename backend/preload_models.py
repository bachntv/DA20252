print("Pre-loading models during Docker build...")
try:
    from utils.recommender_loader import recommender
    recommender.load()
    print("Models pre-loaded successfully during build!")
except Exception as e:
    print(f"Failed to pre-load models: {e}")
    # Don't fail the build, just warn