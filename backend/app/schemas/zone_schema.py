from pydantic import BaseModel, conint


class ZoneSubzoneView(BaseModel):
    code: str
    label: str


class ZoneView(BaseModel):
    zone_number: int
    subzone_count: int
    subzones: list[ZoneSubzoneView] = []


class ZoneUpsertRequest(BaseModel):
    zone_number: conint(ge=1)
    subzone_count: conint(ge=0) = 0


class ZoneDeleteResponse(BaseModel):
    zone_number: int
    message: str