//
//  StateAddFamily.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateAddFamily: FFState {
    public static var ACTION_ADDFAMILY: Int = 0x0
    
    public static var ACTION_REMOVEFAMILY: Int = 0x1
    
    private var families: FamilyCollection
    
    internal init(families: FamilyCollection) {
        self.families = families
        super.init(type: FFStateType.ADD_FAMILY)
    }
    
    public override func initState(data: Any) { }
    
    public override func cleanupState() { }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
            case StateAddFamily.ACTION_ADDFAMILY:
            if (data[0] is String) {
                return self.addFamily(familyName: data[0] as! String)
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        case StateAddFamily.ACTION_REMOVEFAMILY:
            return self.removeFamily()
        default:
            return false
        }
    }
    
    private func addFamily(familyName: String) -> Bool {
        if (self.families.getFamily(familyName: familyName) != nil) {
            //TODO: Logger
            return false
        } else {
            self.families.addFamily(familyName: familyName)
            return true
        }
    }
    
    private func removeFamily() -> Bool {
        if (self.families.size() == 0) {
             return false
        } else {
            self.families.removeFamily(index: self.families.size() - 1)
            return true
        }
    }
}
