require "spec_helper"

describe Resources::Job do
  base = { body: {}, action: "destroy", uuid: SecureRandom.uuid }

  it "executes deletion for various resources" do
    device     = FactoryBot.create(:device)
    test_cases = [
      FarmEvent,
      FarmwareInstallation,
      Image,
      Log,
      Peripheral,
      PinBinding,
      PlantTemplate,
      Regimen,
      SavedGarden,
      Sensor,
      SensorReading,
      WebcamFeed,
    ]
    .each{ |k| k.delete_all }
    .map { |k| FactoryBot.create(k.model_name.singular.to_sym, device: device) }
     .concat([FakeSequence.create( device: device)])
     .map do |r|
      base.merge({resource: r.class, resource_id: r.id, device: device})
     end
     .map do |params|
        res   = params[:resource]
        count = res.count
        Resources::Job.run!(params)
        expect(res.count).to eq(count - 1)
     end
  end

  it "doesn't let you delete other people's resources" do
    device_a   = FactoryBot.create(:device)
    device_b   = FactoryBot.create(:device)
    farm_event = FactoryBot.create(:farm_event, device: device_b)
    params     = base.merge(resource:    FarmEvent,
                            resource_id: farm_event.id,
                            device:      device_a)
    result = Resources::Job.run(params)
    expect(result.success?).to be false
    expect(result.errors.message_list).to include(Resources::Job::NOT_FOUND)
  end

  it "deals with edge case resource snooping" do
    device_a   = FactoryBot.create(:device)
    device_b   = FactoryBot.create(:device)
    farm_event = FactoryBot.create(:farm_event, device: device_b)
    FD         = CreateDestroyer.run!(resource: FarmEvent)
    result     = FD.run(farm_event: farm_event, device: device_a)
    errors     = result.errors.message_list
    expect(errors).to include("You do not own that farm_event")
  end

  it "updates points" do
    point  = FactoryBot.create(:generic_pointer)
    result = Resources::Job.run!(body:        {name: "Heyo!"},
                                 resource:    Point,
                                 resource_id: point.id,
                                 device:      point.device,
                                 action:      "save",
                                 uuid:        "whatever")
    expect(result).to be_kind_of(GenericPointer)
    expect(result.name).to eq("Heyo!")
  end

  it "does not support `create` yet" do
    device = FactoryBot.create(:device)
    result = Resources::Job.run(body:        {name: "Heyo!"},
                                resource:    Point,
                                resource_id: 0,
                                device:      device,
                                action:      "save",
                                uuid:        "whatever")
    expect(result.errors.fetch("body").message)
      .to eq(Resources::Job::NO_CREATE_YET)
  end

  it "deals with points" do
    device = FactoryBot.create(:device)
    Devices::Destroy
    params = [
      FactoryBot.create(:generic_pointer, device: device),
      FactoryBot.create(:plant,           device: device),
      FactoryBot.create(:tool_slot,       device: device)
    ].map do |r|
      base.merge({resource: Point, resource_id: r.id, device: device})
    end
    .map do |params|
      res   = params[:resource]
      count = res.where(discarded_at: nil).count
      Resources::Job.run!(params)
      expect(res.where(discarded_at: nil).count).to eq(count - 1)
    end
  end
end
