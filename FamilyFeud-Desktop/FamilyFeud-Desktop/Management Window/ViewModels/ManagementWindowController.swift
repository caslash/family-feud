//
//  ManagementWindowController.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/9/23.
//

import Foundation
import Observation

@Observable
class ManagementWindowController {
    public private(set) var chooseFamilyCommand: Int?
    
    init() { }
    
    public func setChooseFamily(command: Int) {
        self.chooseFamilyCommand = command
    }
}
