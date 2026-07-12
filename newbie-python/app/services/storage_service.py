from app.utils.error.error import BadRequestException
import uuid
from io import BytesIO
from fastapi import UploadFile
from minio import Minio


class StorageService:

    def __init__(self, client: Minio):
        self.client = client

    async def upload_avatar(
        self,
        file: UploadFile,
        bucket: str,
    ) -> str:
    
        try:
            contents = await file.read()
            extension = str(file.filename).split(".")[-1]

            filename = f"{uuid.uuid4()}.{extension}"

            if not self.client.bucket_exists(bucket):
                self.client.make_bucket(bucket)
                # Make the bucket public so avatars can be read anonymously
                policy = {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": "*"},
                            "Action": ["s3:GetObject"],
                            "Resource": [f"arn:aws:s3:::{bucket}/*"]
                        }
                    ]
                }
                import json
                self.client.set_bucket_policy(bucket, json.dumps(policy))

            self.client.put_object(
                bucket_name=bucket,
                object_name=filename,
                data=BytesIO(contents),
                length=len(contents),
                content_type=str(file.content_type),
            )

            # Return the full accessible URL
            from app.config import settings
            return f"{settings.MINIO_ENDPOINT}/{bucket}/{filename}"

        except Exception as e:
            raise BadRequestException(f"Upload failed: {str(e)}")