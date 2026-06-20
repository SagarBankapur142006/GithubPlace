import asyncio
from app.services.ai_evaluator import evaluate_readme

async def main():
    try:
        res = await evaluate_readme("This is a test readme for extension_for_saving.")
        print("SUCCESS:")
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
