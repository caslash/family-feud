//
//  ManagementWindowController.swift
//  FamilyFeud-Desktop
//
//  Created by Cameron Slash on 12/9/23.
//

import Foundation

class ManagementWindowController: ObservableObject {
    public static var shared = ManagementWindowController()
    
    @Published public private(set) var chooseFamilyCommand: Int?
    
    init() { }
    
    public func setChooseFamily(command: Int) {
        self.chooseFamilyCommand = command
    }
}
